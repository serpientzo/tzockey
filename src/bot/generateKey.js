const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");

const db = require("../database/database");
const { generateKey } = require("../utils/keyGenerator");

const UNIT_MULTIPLIER = {
  seconds: 1,
  minutes: 60,
  hours: 60 * 60,
  days: 24 * 60 * 60,
};

const UNIT_MAX = {
  seconds: 315360000,
  minutes: 5256000,
  hours: 87600,
  days: 3650,
};

const command = new SlashCommandBuilder()
  .setName("generate-key")
  .setDescription("Generate Tzockey access key")
  .addStringOption((option) =>
    option
      .setName("product")
      .setDescription("Pilih product")
      .setRequired(true)
      .setAutocomplete(true),
  )
  .addIntegerOption((option) =>
    option
      .setName("duration")
      .setDescription("Durasi key")
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(315360000),
  )
  .addStringOption((option) =>
    option
      .setName("unit")
      .setDescription("Satuan durasi")
      .setRequired(true)
      .addChoices(
        {
          name: "Seconds",
          value: "seconds",
        },
        {
          name: "Minutes",
          value: "minutes",
        },
        {
          name: "Hours",
          value: "hours",
        },
        {
          name: "Days",
          value: "days",
        },
      ),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

async function execute(interaction) {
  const productName = interaction.options.getString("product").trim();

  const duration = interaction.options.getInteger("duration");

  const unit = interaction.options.getString("unit");

  const product = db
    .prepare(
      `
        SELECT *
        FROM products
        WHERE LOWER(name) = LOWER(?)
        AND status = 'Active'
    `,
    )
    .get(productName);

  if (!product) {
    return interaction.reply({
      content: `❌ Product \`${productName}\` tidak ditemukan atau tidak aktif.`,
      ephemeral: true,
    });
  }

  if (!UNIT_MULTIPLIER[unit]) {
    return interaction.reply({
      content: "❌ Unit duration tidak valid.",
      ephemeral: true,
    });
  }

  if (duration > UNIT_MAX[unit]) {
    return interaction.reply({
      content:
        `❌ Duration terlalu besar untuk unit \`${unit}\`.\n\n` +
        `Maksimal: \`${UNIT_MAX[unit]}\` ${unit}.`,
      ephemeral: true,
    });
  }

  const durationSeconds = duration * UNIT_MULTIPLIER[unit];

  const key = generateKey();
  const createdAt = Date.now();

  const plan = `${duration} ${unit}`;

  db.prepare(
    `
        INSERT INTO keys (
            key,
            product_id,
            plan,
            duration_seconds,
            created_at,
            expires_at,
            discord_id,
            hwid,
            status,
            reset_count
        )
        VALUES (
            ?,
            ?,
            ?,
            ?,
            ?,
            NULL,
            NULL,
            NULL,
            'Unused',
            0
        )
    `,
  ).run(key, product.id, plan, durationSeconds, createdAt);

  await interaction.reply({
    content:
      `🔑 **Key berhasil dibuat!**\n\n` +
      `Key: \`${key}\`\n` +
      `Product: \`${product.name}\`\n` +
      `Duration: \`${duration} ${unit}\`\n` +
      `Duration Seconds: \`${durationSeconds}\`\n` +
      `Status: \`Unused\``,
    ephemeral: true,
  });
}

async function autocomplete(interaction) {
  const focusedValue = interaction.options.getString("product").toLowerCase();

  const products = db
    .prepare(
      `
        SELECT name
        FROM products
        WHERE status = 'Active'
        AND LOWER(name) LIKE ?
        ORDER BY name ASC
        LIMIT 25
    `,
    )
    .all(`%${focusedValue}%`);

  await interaction.respond(
    products.map((product) => ({
      name: product.name,
      value: product.name,
    })),
  );
}

module.exports = {
  command,
  execute,
  autocomplete,
};
