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

  /*
  |--------------------------------------------------------------------------
  | Find Active Key
  |--------------------------------------------------------------------------
  */

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

  /*
  |--------------------------------------------------------------------------
  | Reset HWID
  |--------------------------------------------------------------------------
  */

  try {
    const adminResetHwid = db.transaction(() => {
      /*
        | Hapus session lama.
        */

      db.prepare(
        `
            DELETE FROM sessions
            WHERE key_id = ?
          `,
      ).run(keyData.id);

      /*
        | Reset HWID.
        |
        | reset_count sengaja tidak diubah.
        */

      db.prepare(
        `
            UPDATE keys
            SET hwid = NULL
            WHERE id = ?
            AND status = 'Active'
          `,
      ).run(keyData.id);
    });

    adminResetHwid();
  } catch (error) {
    console.error("Admin Reset HWID Database Error:", error);

    return interaction.reply({
      content: "Terjadi kesalahan saat melakukan admin reset HWID.",
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
