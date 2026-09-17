const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} = require("discord.js");

const db = require("../database/database");

const command = new SlashCommandBuilder()
  .setName("list-keys")
  .setDescription("Melihat daftar Tzockey key")
  .addStringOption((option) =>
    option
      .setName("status")
      .setDescription("Filter berdasarkan status")
      .setRequired(false)
      .addChoices(
        { name: "Unused", value: "Unused" },
        { name: "Active", value: "Active" },
        { name: "Expired", value: "Expired" },
        { name: "Disabled", value: "Disabled" },
      ),
  )
  .addStringOption((option) =>
    option
      .setName("product")
      .setDescription("Filter berdasarkan product")
      .setRequired(false)
      .setAutocomplete(true),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

async function execute(interaction) {
  const status = interaction.options.getString("status");
  const productName = interaction.options.getString("product");

  // Tandai key Active yang sudah expired.
  db.prepare(
    `
        UPDATE keys
        SET status = 'Expired'
        WHERE status = 'Active'
        AND expires_at IS NOT NULL
        AND expires_at <= ?
    `,
  ).run(Date.now());

  let query = `
        SELECT
            keys.*,
            products.name AS product_name
        FROM keys
        JOIN products
            ON products.id = keys.product_id
    `;

  const conditions = [];
  const params = [];

  if (status) {
    conditions.push("keys.status = ?");
    params.push(status);
  }

  if (productName) {
    conditions.push("LOWER(products.name) = LOWER(?)");
    params.push(productName.trim());
  }

  if (conditions.length > 0) {
    query += `
            WHERE ${conditions.join(" AND ")}
        `;
  }

  query += `
        ORDER BY keys.id DESC
        LIMIT 25
    `;

  const keys = db.prepare(query).all(...params);

  if (keys.length === 0) {
    return interaction.reply({
      content: "❌ Tidak ada key yang ditemukan.",
      ephemeral: true,
    });
  }

  const lines = keys.map((keyData, index) => {
    const discord = keyData.discord_id
      ? `<@${keyData.discord_id}>`
      : "Unredeemed";

    const expires = keyData.expires_at
      ? `<t:${Math.floor(keyData.expires_at / 1000)}:R>`
      : "Never";

    return (
      `**${index + 1}. \`${keyData.key}\`**\n` +
      `Product: \`${keyData.product_name}\` | ` +
      `Plan: \`${keyData.plan}\`\n` +
      `Status: \`${keyData.status}\` | ` +
      `User: ${discord}\n` +
      `Expires: ${expires}`
    );
  });

  const embed = new EmbedBuilder()
    .setTitle("🔑 Tzockey Keys")
    .setDescription(lines.join("\n\n"))
    .setFooter({
      text: `Menampilkan ${keys.length} key`,
    })
    .setTimestamp();

  await interaction.reply({
    embeds: [embed],
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
