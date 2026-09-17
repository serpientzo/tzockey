const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");

const db = require("../database/database");

const command = new SlashCommandBuilder()
  .setName("get-loader")
  .setDescription("Menampilkan loadstring Tzockey")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

async function execute(interaction) {
  const settings = db
    .prepare(
      `
        SELECT key, value
        FROM settings
        WHERE key IN ('loader_url', 'loader_version')
    `,
    )
    .all();

  const data = Object.fromEntries(
    settings.map((setting) => [setting.key, setting.value]),
  );

  if (!data.loader_url) {
    return interaction.reply({
      content:
        "Loader URL belum diatur.\n\n" +
        "Gunakan `/set-loader-url` terlebih dahulu.",
      ephemeral: true,
    });
  }

  const version = data.loader_version || "Unknown";

  const loadstring = `loadstring(game:HttpGet("${data.loader_url}"))()`;

  return interaction.reply({
    content:
      `Tzockey Loader v${version}\n\n` + "```lua\n" + loadstring + "\n```",
    ephemeral: true,
  });
}

module.exports = {
  command,
  execute,
};
