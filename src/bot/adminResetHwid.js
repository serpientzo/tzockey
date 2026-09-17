const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");

const db = require("../database/database");

const command = new SlashCommandBuilder()
  .setName("admin-reset-hwid")
  .setDescription("Reset HWID user secara manual")
  .addUserOption((option) =>
    option
      .setName("user")
      .setDescription("User yang ingin di-reset HWID-nya")
      .setRequired(true),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

async function execute(interaction) {
  const user = interaction.options.getUser("user");

  const keyData = db
    .prepare(
      `
        SELECT *
        FROM keys
        WHERE discord_id = ?
        AND status = 'Active'
        LIMIT 1
      `,
    )
    .get(user.id);

  if (!keyData) {
    return interaction.reply({
      content: `${user.tag} tidak memiliki key aktif.`,
      ephemeral: true,
    });
  }

  // Hapus session lama
  db.prepare(
    `
      DELETE FROM sessions
      WHERE key_id = ?
    `,
  ).run(keyData.id);

  // Reset HWID tanpa menambah reset_count
  db.prepare(
    `
      UPDATE keys
      SET hwid = NULL
      WHERE id = ?
    `,
  ).run(keyData.id);

  await interaction.reply({
    content:
      "HWID berhasil di-reset.\n\n" +
      `User: ${user.tag}\n` +
      `Key: \`${keyData.key}\`\n` +
      `Reset Count: \`${keyData.reset_count}/3\``,
    ephemeral: true,
  });
}

module.exports = {
  command,
  execute,
};
