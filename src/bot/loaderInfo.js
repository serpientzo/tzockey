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
        SELECT
          key,
          value
        FROM settings
        WHERE key IN (
          'loader_url',
          'loader_version'
        )
      `,
    )
    .all();

  const data = Object.fromEntries(
    settings.map((setting) => [setting.key, setting.value]),
  );

  /*
  |--------------------------------------------------------------------------
  | Validate Loader URL
  |--------------------------------------------------------------------------
  */

  if (!data.loader_url || typeof data.loader_url !== "string") {
    return interaction.reply({
      content: "Loader URL belum dikonfigurasi.",
      ephemeral: true,
    });
  }

  const loaderUrl = data.loader_url.trim();

  let parsedUrl;

  try {
    parsedUrl = new URL(loaderUrl);
  } catch {
    return interaction.reply({
      content:
        "Loader URL tidak valid.\n\n" +
        "Gunakan `/set-loader-url` untuk mengatur ulang.",
      ephemeral: true,
    });
  }

  if (parsedUrl.protocol !== "https:") {
    return interaction.reply({
      content: "Loader URL harus menggunakan HTTPS.",
      ephemeral: true,
    });
  }

  if (parsedUrl.username || parsedUrl.password) {
    return interaction.reply({
      content: "Loader URL tidak valid.",
      ephemeral: true,
    });
  }

  /*
  |--------------------------------------------------------------------------
  | Loader Version
  |--------------------------------------------------------------------------
  */

  const version =
    typeof data.loader_version === "string" && data.loader_version.trim()
      ? data.loader_version.trim()
      : "Unknown";

  /*
  |--------------------------------------------------------------------------
  | Build Embed
  |--------------------------------------------------------------------------
  */

  const embed = new EmbedBuilder()
    .setTitle("Loader Information")
    .addFields(
      {
        name: "Version",
        value: `\`${version}\``,
        inline: true,
      },
      {
        name: "Status",
        value: "`Configured`",
        inline: true,
      },
      {
        name: "URL",
        value: `\`${parsedUrl.toString()}\``,
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
