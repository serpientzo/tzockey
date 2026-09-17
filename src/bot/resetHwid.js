const { SlashCommandBuilder } = require("discord.js");

const db = require("../database/database");

const MAX_RESETS = 3;

const command = new SlashCommandBuilder()
  .setName("reset-hwid")
  .setDescription("Reset HWID pada key aktif kamu");

async function execute(interaction) {
  const discordId = interaction.user.id;

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
    .get(discordId);

  if (!keyData) {
    return interaction.reply({
      content: "Kamu tidak memiliki key aktif.",
      ephemeral: true,
    });
  }

  if (keyData.expires_at && Date.now() >= keyData.expires_at) {
    db.prepare(
      `
        UPDATE keys
        SET status = 'Expired'
        WHERE id = ?
      `,
    ).run(keyData.id);

    return interaction.reply({
      content: "Key kamu sudah expired.",
      ephemeral: true,
    });
  }

  if (!keyData.hwid) {
    return interaction.reply({
      content: "Key kamu belum memiliki HWID.",
      ephemeral: true,
    });
  }

  if (keyData.reset_count >= MAX_RESETS) {
    return interaction.reply({
      content:
        "Batas reset HWID sudah tercapai.\n\n" +
        `Batas reset: ${MAX_RESETS} kali\n` +
        `Reset digunakan: ${keyData.reset_count} kali\n\n` +
        "Hubungi admin jika kamu perlu melakukan reset lagi.",
      ephemeral: true,
    });
  }

  const newResetCount = keyData.reset_count + 1;

  // Hapus session lama
  db.prepare(
    `
      DELETE FROM sessions
      WHERE key_id = ?
    `,
  ).run(keyData.id);

  // Reset HWID
  db.prepare(
    `
      UPDATE keys
      SET
        hwid = NULL,
        reset_count = ?
      WHERE id = ?
    `,
  ).run(newResetCount, keyData.id);

  await interaction.reply({
    content:
      "HWID berhasil di-reset.\n\n" +
      `Key: \`${keyData.key}\`\n` +
      `Reset Count: \`${newResetCount}/${MAX_RESETS}\`\n\n` +
      "HWID baru akan didaftarkan ketika kamu menjalankan script kembali.",
    ephemeral: true,
  });
}

module.exports = {
  command,
  execute,
};
