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

  const keyData = db
    .prepare(
      `
        SELECT
            keys.*,
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
      content: "❌ Key tidak ditemukan.",
      ephemeral: true,
    });
  }

  if (keyData.status === "Disabled") {
    return interaction.reply({
      content: "❌ Key tersebut sudah dalam keadaan Disabled.",
      ephemeral: true,
    });
  }

  db.prepare(
    `
        UPDATE keys
        SET status = 'Disabled'
        WHERE id = ?
    `,
  ).run(keyData.id);

  // Hapus session aktif agar key langsung tidak dapat digunakan.
  db.prepare(
    `
        DELETE FROM sessions
        WHERE key_id = ?
    `,
  ).run(keyData.id);

  await interaction.reply({
    content:
      `🔒 **Key berhasil dinonaktifkan.**\n\n` +
      `Key: \`${keyData.key}\`\n` +
      `Product: \`${keyData.product_name}\`\n` +
      `Status: \`Disabled\``,
    ephemeral: true,
  });
}

module.exports = {
  command,
  execute,
};
