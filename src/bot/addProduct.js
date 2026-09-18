const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");

const db = require("../database/database");

const MAX_PRODUCT_NAME_LENGTH = 100;
const MAX_SCRIPT_URL_LENGTH = 2048;

const command = new SlashCommandBuilder()
  .setName("add-product")
  .setDescription("Menambahkan product baru ke Tzockey")
  .addStringOption((option) =>
    option
      .setName("name")
      .setDescription("Nama product")
      .setRequired(true)
      .setMaxLength(MAX_PRODUCT_NAME_LENGTH),
  )
  .addStringOption((option) =>
    option
      .setName("url")
      .setDescription("URL script product")
      .setRequired(true)
      .setMaxLength(MAX_SCRIPT_URL_LENGTH),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

async function execute(interaction) {
  const name = interaction.options.getString("name").trim();

  const urlInput = interaction.options.getString("url").trim();

  /*
  |--------------------------------------------------------------------------
  | Validate Product Name
  |--------------------------------------------------------------------------
  */

  if (!name) {
    return interaction.reply({
      content: "Nama product tidak boleh kosong.",
      ephemeral: true,
    });
  }

  /*
  |--------------------------------------------------------------------------
  | Validate URL
  |--------------------------------------------------------------------------
  */

  let url;

  try {
    url = new URL(urlInput);
  } catch {
    return interaction.reply({
      content: "URL script tidak valid.",
      ephemeral: true,
    });
  }

  if (url.protocol !== "https:") {
    return interaction.reply({
      content: "URL script harus menggunakan HTTPS.",
      ephemeral: true,
    });
  }

  if (url.username || url.password) {
    return interaction.reply({
      content: "URL script tidak boleh mengandung username atau password.",
      ephemeral: true,
    });
  }

  /*
  |--------------------------------------------------------------------------
  | Check Existing Product
  |--------------------------------------------------------------------------
  */

  const existingProduct = db
    .prepare(
      `
        SELECT id
        FROM products
        WHERE LOWER(name) = LOWER(?)
      `,
    )
    .get(name);

  if (existingProduct) {
    return interaction.reply({
      content: `Product \`${name}\` sudah ada.`,
      ephemeral: true,
    });
  }

  /*
  |--------------------------------------------------------------------------
  | Insert Product
  |--------------------------------------------------------------------------
  */

  try {
    const result = db
      .prepare(
        `
          INSERT INTO products (
            name,
            script_url,
            status,
            created_at
          )
          VALUES (
            ?,
            ?,
            'Active',
            ?
          )
        `,
      )
      .run(name, url.toString(), Date.now());

    /*
    |--------------------------------------------------------------------------
    | Response
    |--------------------------------------------------------------------------
    */

    return interaction.reply({
      content:
        "Product berhasil ditambahkan.\n\n" +
        `ID: \`${result.lastInsertRowid}\`\n` +
        `Name: \`${name}\`\n` +
        `Status: \`Active\``,
      ephemeral: true,
    });
  } catch (error) {
    console.error("Add Product Database Error:", error);

    return interaction.reply({
      content: "Terjadi kesalahan saat menambahkan product.",
      ephemeral: true,
    });
  }
}

module.exports = {
  command,
  execute,
};
