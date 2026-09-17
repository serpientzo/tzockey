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

  if (keyData.status !== "Disabled") {
    return interaction.reply({
      content:
        `❌ Key tidak sedang Disabled.\n\n` +
        `Status saat ini: \`${keyData.status}\``,
      ephemeral: true,
    });
  }

  let newStatus;

  if (!keyData.expires_at) {
    // Key belum pernah di-redeem.
    newStatus = "Unused";
  } else if (Date.now() >= keyData.expires_at) {
    // Key sudah melewati masa berlaku.
    newStatus = "Expired";
  } else {
    // Key masih memiliki masa aktif.
    newStatus = "Active";
  }

  db.prepare(
    `
        UPDATE keys
        SET status = ?
        WHERE id = ?
    `,
  ).run(newStatus, keyData.id);

  await interaction.reply({
    content:
      `🔓 **Key berhasil diaktifkan kembali.**\n\n` +
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
