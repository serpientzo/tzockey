const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");

const db = require("../database/database");

const command = new SlashCommandBuilder()
  .setName("add-product")
  .setDescription("Menambahkan product baru ke Tzockey")
  .addStringOption((option) =>
    option.setName("name").setDescription("Nama product").setRequired(true),
  )
  .addStringOption((option) =>
    option
      .setName("url")
      .setDescription("URL script product")
      .setRequired(true),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

async function execute(interaction) {
  const name = interaction.options.getString("name").trim();

  const url = interaction.options.getString("url").trim();

  try {
    new URL(url);
  } catch {
    return interaction.reply({
      content: "❌ URL script tidak valid.",
      ephemeral: true,
    });
  }

  const existingProduct = db
    .prepare(
      `
        SELECT *
        FROM products
        WHERE LOWER(name) = LOWER(?)
    `,
    )
    .get(name);

  if (existingProduct) {
    return interaction.reply({
      content: `❌ Product \`${name}\` sudah ada.`,
      ephemeral: true,
    });
  }

  const result = db
    .prepare(
      `
        INSERT INTO products (
            name,
            script_url,
            status,
            created_at
        )
        VALUES (?, ?, 'Active', ?)
    `,
    )
    .run(name, url, Date.now());

  await interaction.reply({
    content:
      `✅ Product berhasil ditambahkan!\n\n` +
      `ID: \`${result.lastInsertRowid}\`\n` +
      `Name: \`${name}\`\n` +
      `Status: \`Active\``,
    ephemeral: true,
  });
}

module.exports = {
  command,
  execute,
};
