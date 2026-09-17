const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");

const db = require("../database/database");

const command = new SlashCommandBuilder()
  .setName("delete-key")
  .setDescription("Delete a Tzockey key")
  .addStringOption((option) =>
    option
      .setName("key")
      .setDescription("Key yang ingin dihapus")
      .setRequired(true),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

async function execute(interaction) {
  const key = interaction.options.getString("key").trim().toUpperCase();

  const keyData = db
    .prepare(
      `
        SELECT *
        FROM keys
        WHERE key = ?
      `,
    )
    .get(key);

  if (!keyData) {
    return interaction.reply({
      content: "Key tidak ditemukan.",
      ephemeral: true,
    });
  }

  db.prepare(
    `
      DELETE FROM keys
      WHERE key = ?
    `,
  ).run(key);

  await interaction.reply({
    content: `Key berhasil dihapus.\n\n` + `Key: \`${key}\``,
    ephemeral: true,
  });
}

module.exports = {
  command,
  execute,
};
