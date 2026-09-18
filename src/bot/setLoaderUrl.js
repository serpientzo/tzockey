const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");

const db = require("../database/database");

const command = new SlashCommandBuilder()
  .setName("set-loader-url")
  .setDescription("Mengatur URL dan version loader Tzockey")
  .addStringOption((option) =>
    option
      .setName("url")
      .setDescription("URL HTTPS raw loader")
      .setRequired(true),
  )
  .addStringOption((option) =>
    option
      .setName("version")
      .setDescription("Version loader, contoh 1.0.0")
      .setRequired(true),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

async function execute(interaction) {
  const urlInput = interaction.options.getString("url");

  const versionInput = interaction.options.getString("version");

  const url = urlInput.trim();

  const version = versionInput.trim();

  /*
  |--------------------------------------------------------------------------
  | Validate URL
  |--------------------------------------------------------------------------
  */

  if (!url) {
    return interaction.reply({
      content: "URL loader tidak boleh kosong.",
      ephemeral: true,
    });
  }

  if (url.length > 2048) {
    return interaction.reply({
      content: "URL loader terlalu panjang.",
      ephemeral: true,
    });
  }

  let parsedUrl;

  try {
    parsedUrl = new URL(url);
  } catch {
    return interaction.reply({
      content: "URL loader tidak valid.",
      ephemeral: true,
    });
  }

  if (parsedUrl.protocol !== "https:") {
    return interaction.reply({
      content: "URL loader harus menggunakan HTTPS.",
      ephemeral: true,
    });
  }

  if (parsedUrl.username || parsedUrl.password) {
    return interaction.reply({
      content: "URL loader tidak valid.",
      ephemeral: true,
    });
  }

  /*
  |--------------------------------------------------------------------------
  | Validate Version
  |--------------------------------------------------------------------------
  */

  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    return interaction.reply({
      content:
        "Format version tidak valid.\n\n" + "Gunakan format seperti `1.0.0`.",
      ephemeral: true,
    });
  }

  /*
  |--------------------------------------------------------------------------
  | Update Settings
  |--------------------------------------------------------------------------
  */

  try {
    const update = db.prepare(
      `
          INSERT INTO settings (
            key,
            value
          )
          VALUES (?, ?)
          ON CONFLICT(key)
          DO UPDATE SET
            value = excluded.value
        `,
    );

    const updateLoader = db.transaction(() => {
      update.run("loader_url", parsedUrl.toString());

      update.run("loader_version", version);
    });

    updateLoader();
  } catch (error) {
    console.error("Set Loader URL Database Error:", error);

    return interaction.reply({
      content: "Terjadi kesalahan saat memperbarui loader.",
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
      "Loader berhasil diperbarui.\n\n" +
      `Version: \`${version}\`\n` +
      `URL: \`${parsedUrl.toString()}\``,
    ephemeral: true,
  });
}

module.exports = {
  command,
  execute,
};
