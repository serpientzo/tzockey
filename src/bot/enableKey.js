const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");

const db = require("../database/database");

const command = new SlashCommandBuilder()
  .setName("enable-key")
  .setDescription("Mengaktifkan kembali Tzockey key")
  .addStringOption((option) =>
    option
      .setName("key")
      .setDescription("Key yang ingin diaktifkan")
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
          keys.expires_at,
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

  if (keyData.status !== "Disabled") {
    return interaction.reply({
      content:
        "Key tidak sedang Disabled.\n\n" +
        `Status saat ini: \`${keyData.status}\``,
      ephemeral: true,
    });
  }

  /*
  |--------------------------------------------------------------------------
  | Determine New Status
  |--------------------------------------------------------------------------
  */

  const now = Date.now();

  let newStatus;

  if (!keyData.expires_at) {
    /*
     * Key belum pernah di-redeem.
     */
    newStatus = "Unused";
  } else if (now >= keyData.expires_at) {
    /*
     * Key sudah expired.
     */
    newStatus = "Expired";
  } else {
    /*
     * Key masih memiliki masa aktif.
     */
    newStatus = "Active";
  }

  /*
  |--------------------------------------------------------------------------
  | Enable Key
  |--------------------------------------------------------------------------
  */

  try {
    const enableKey = db.transaction(() => {
      const result = db
        .prepare(
          `
              UPDATE keys
              SET status = ?
              WHERE id = ?
              AND status = 'Disabled'
            `,
        )
        .run(newStatus, keyData.id);

      if (result.changes !== 1) {
        throw new Error("Key gagal diaktifkan.");
      }
    });

    enableKey();
  } catch (error) {
    console.error("Enable Key Database Error:", error);

    return interaction.reply({
      content: "Terjadi kesalahan saat mengaktifkan key.",
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
      "Key berhasil diaktifkan kembali.\n\n" +
      `Key: \`${keyData.key}\`\n` +
      `Product: \`${keyData.product_name}\`\n` +
      `Status: \`${newStatus}\``,
    ephemeral: true,
  });
}

module.exports = {
  command,
  execute,
};
