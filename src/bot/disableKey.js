const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");

const db = require("../database/database");

const command = new SlashCommandBuilder()
  .setName("disable-key")
  .setDescription("Menonaktifkan Tzockey key")
  .addStringOption((option) =>
    option
      .setName("key")
      .setDescription("Key yang ingin dinonaktifkan")
      .setRequired(true),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

async function execute(interaction) {
  const key = interaction.options.getString("key").trim().toUpperCase();

  /*
  |--------------------------------------------------------------------------
  | Find Key
  |--------------------------------------------------------------------------
  */

  const keyData = db
    .prepare(
      `
        SELECT
          keys.id,
          keys.key,
          keys.status,
          products.name AS product_name
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
  | Check Status
  |--------------------------------------------------------------------------
  */

  if (keyData.status === "Disabled") {
    return interaction.reply({
      content: "Key tersebut sudah dalam keadaan Disabled.",
      ephemeral: true,
    });
  }

  /*
  |--------------------------------------------------------------------------
  | Disable Key
  |--------------------------------------------------------------------------
  */

  try {
    const disableKey = db.transaction(() => {
      const result = db
        .prepare(
          `
              UPDATE keys
              SET status = 'Disabled'
              WHERE id = ?
              AND status != 'Disabled'
            `,
        )
        .run(keyData.id);

      if (result.changes !== 1) {
        throw new Error("Key gagal dinonaktifkan.");
      }

      /*
       * Hapus session aktif.
       * Key yang disabled harus langsung
       * tidak dapat digunakan oleh API.
       */
      db.prepare(
        `
            DELETE FROM sessions
            WHERE key_id = ?
          `,
      ).run(keyData.id);
    });

    disableKey();
  } catch (error) {
    console.error("Disable Key Database Error:", error);

    return interaction.reply({
      content: "Terjadi kesalahan saat menonaktifkan key.",
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
      "Key berhasil dinonaktifkan.\n\n" +
      `Key: \`${keyData.key}\`\n` +
      `Product: \`${keyData.product_name}\`\n` +
      "Status: `Disabled`",
    ephemeral: true,
  });
}

module.exports = {
  command,
  execute,
};
