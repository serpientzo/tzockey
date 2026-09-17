const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} = require("discord.js");

const db = require("../database/database");

const command = new SlashCommandBuilder()
  .setName("loader-info")
  .setDescription("Melihat informasi loader Tzockey")
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
      content: "Loader URL belum dikonfigurasi.",
      ephemeral: true,
    });
  }

  const embed = new EmbedBuilder()
    .setTitle("Loader Information")
    .addFields(
      {
        name: "Version",
        value: `\`${data.loader_version || "Unknown"}\``,
        inline: true,
      },
      {
        name: "Status",
        value: "`Active`",
        inline: true,
      },
      {
        name: "URL",
        value: `\`${data.loader_url}\``,
        inline: false,
      },
    )
    .setFooter({
      text: "Tzockey Loader Management",
    })
    .setTimestamp();

  return interaction.reply({
    embeds: [embed],
    ephemeral: true,
  });
}

module.exports = {
  command,
  execute,
};
