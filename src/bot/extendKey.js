const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");

const db = require("../database/database");

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
  .setName("extend-key")
  .setDescription("Memperpanjang masa berlaku Tzockey key")
  .addStringOption((option) =>
    option
      .setName("key")
      .setDescription("Key yang ingin diperpanjang")
      .setRequired(true),
  )
  .addIntegerOption((option) =>
    option
      .setName("duration")
      .setDescription("Durasi tambahan")
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
  const key = interaction.options.getString("key").trim().toUpperCase();

  const duration = interaction.options.getInteger("duration");

  const unit = interaction.options.getString("unit");

  /*
  |--------------------------------------------------------------------------
  | Validate Unit
  |--------------------------------------------------------------------------
  */

  if (!Object.prototype.hasOwnProperty.call(UNIT_MULTIPLIER, unit)) {
    return interaction.reply({
      content: "Unit duration tidak valid.",
      ephemeral: true,
    });
  }

  /*
  |--------------------------------------------------------------------------
  | Validate Duration
  |--------------------------------------------------------------------------
  */

  if (!Number.isInteger(duration) || duration < 1) {
    return interaction.reply({
      content: "Duration tidak valid.",
      ephemeral: true,
    });
  }

  if (duration > UNIT_MAX[unit]) {
    return interaction.reply({
      content:
        `Duration terlalu besar untuk unit \`${unit}\`.\n\n` +
        `Maksimal: \`${UNIT_MAX[unit]}\` ${unit}.`,
      ephemeral: true,
    });
  }

  const durationSeconds = duration * UNIT_MULTIPLIER[unit];

  if (!Number.isSafeInteger(durationSeconds)) {
    return interaction.reply({
      content: "Duration menghasilkan nilai yang tidak valid.",
      ephemeral: true,
    });
  }

  const durationMilliseconds = durationSeconds * 1000;

  if (!Number.isSafeInteger(durationMilliseconds)) {
    return interaction.reply({
      content: "Duration terlalu besar.",
      ephemeral: true,
    });
  }

  /*
  |--------------------------------------------------------------------------
  | Find Key
  |--------------------------------------------------------------------------
  */

  const keyData = db
    .prepare(
      `
        SELECT
          keys.*,
          products.name AS product_name,
          products.status AS product_status
        FROM keys
        JOIN products
          ON products.id = keys.product_id
        WHERE keys.key = ?
      `,
    )
    .get(key);

  if (!keyData) {
    return interaction.reply({
      content: "Key tidak ditemukan.",
      ephemeral: true,
    });
  }

  /*
  |--------------------------------------------------------------------------
  | Validate Key Status
  |--------------------------------------------------------------------------
  */

  if (keyData.status === "Disabled") {
    return interaction.reply({
      content: "Key tersebut sedang disabled dan tidak dapat diperpanjang.",
      ephemeral: true,
    });
  }

  if (keyData.status === "Unused") {
    return interaction.reply({
      content:
        "Key tersebut belum di-redeem.\n" +
        "Redeem key terlebih dahulu sebelum memperpanjang masa berlaku.",
      ephemeral: true,
    });
  }

  if (keyData.status !== "Active" && keyData.status !== "Expired") {
    return interaction.reply({
      content: `Key tidak dapat diperpanjang karena status saat ini \`${keyData.status}\`.`,
      ephemeral: true,
    });
  }

  /*
  |--------------------------------------------------------------------------
  | Calculate Expiration
  |--------------------------------------------------------------------------
  */

  const now = Date.now();

  let newExpiresAt;

  if (
    keyData.status === "Expired" ||
    !keyData.expires_at ||
    keyData.expires_at <= now
  ) {
    newExpiresAt = now + durationMilliseconds;
  } else {
    newExpiresAt = keyData.expires_at + durationMilliseconds;
  }

  if (!Number.isSafeInteger(newExpiresAt)) {
    return interaction.reply({
      content: "Tanggal expiration yang dihasilkan tidak valid.",
      ephemeral: true,
    });
  }

  /*
  |--------------------------------------------------------------------------
  | Calculate Extension
  |--------------------------------------------------------------------------
  */

  const currentExtendedSeconds = Number(keyData.extended_seconds || 0);

  const newExtendedSeconds = currentExtendedSeconds + durationSeconds;

  if (!Number.isSafeInteger(newExtendedSeconds)) {
    return interaction.reply({
      content: "Total extension terlalu besar.",
      ephemeral: true,
    });
  }

  /*
  |--------------------------------------------------------------------------
  | Update Key
  |--------------------------------------------------------------------------
  */

  try {
    const extendKey = db.transaction(() => {
      db.prepare(
        `
            UPDATE keys
            SET
              expires_at = ?,
              extended_seconds = ?,
              status = 'Active'
            WHERE id = ?
          `,
      ).run(newExpiresAt, newExtendedSeconds, keyData.id);
    });

    extendKey();
  } catch (error) {
    console.error("Extend Key Database Error:", error);

    return interaction.reply({
      content: "Terjadi kesalahan saat memperpanjang key.",
      ephemeral: true,
    });
  }

  /*
  |--------------------------------------------------------------------------
  | Response
  |--------------------------------------------------------------------------
  */

  return interaction.reply({
    content:
      "Key berhasil diperpanjang.\n\n" +
      `Key: \`${keyData.key}\`\n` +
      `Product: \`${keyData.product_name}\`\n` +
      `Tambahan: \`${duration} ${unit}\`\n` +
      `Total Extension: \`${newExtendedSeconds}\` seconds\n` +
      `Expires: <t:${Math.floor(newExpiresAt / 1000)}:F>\n` +
      `Remaining: <t:${Math.floor(newExpiresAt / 1000)}:R>\n` +
      `Status: \`Active\``,
    ephemeral: true,
  });
}

module.exports = {
  command,
  execute,
};
