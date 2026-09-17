const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");

const db = require("../database/database");

const command = new SlashCommandBuilder()
  .setName("set-loader-url")
  .setDescription("Mengatur URL dan version loader Tzockey")
  .addStringOption((option) =>
    option.setName("url").setDescription("URL raw loader").setRequired(true),
  )
  .addStringOption((option) =>
    option
      .setName("version")
      .setDescription("Version loader, contoh 1.0.0")
      .setRequired(true),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

async function execute(interaction) {
  const url = interaction.options.getString("url").trim();

  const version = interaction.options.getString("version").trim();

  let parsedUrl;

  try {
    parsedUrl = new URL(url);
  } catch {
    return interaction.reply({
      content: "URL loader tidak valid.",
      ephemeral: true,
    });
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    return interaction.reply({
      content: "URL loader harus menggunakan HTTP atau HTTPS.",
      ephemeral: true,
    });
  }

  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    return interaction.reply({
      content:
        "Format version tidak valid.\n\n" + "Gunakan format seperti `1.0.0`.",
      ephemeral: true,
    });
  }

  const update = db.prepare(`
        INSERT INTO settings (key, value)
        VALUES (?, ?)
        ON CONFLICT(key)
        DO UPDATE SET value = excluded.value
    `);

  const updateLoader = db.transaction(() => {
    update.run("loader_url", url);
    update.run("loader_version", version);
  });

  updateLoader();

  await interaction.reply({
    content:
      "Loader berhasil diperbarui.\n\n" +
      `Version: \`${version}\`\n` +
      `URL: \`${url}\``,
    ephemeral: true,
  });
}

module.exports = {
  command,
  execute,
};
