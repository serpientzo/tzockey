const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");

const db = require("../database/database");

const MAX_PRODUCT_NAME_LENGTH = 100;
const MAX_SCRIPT_URL_LENGTH = 2048;

const command = new SlashCommandBuilder()
  .setName("edit-product")
  .setDescription("Mengubah informasi Tzockey product")
  .addStringOption((option) =>
    option
      .setName("product")
      .setDescription("Product yang ingin diubah")
      .setRequired(true)
      .setAutocomplete(true),
  )
  .addStringOption((option) =>
    option
      .setName("name")
      .setDescription("Nama baru product")
      .setRequired(false)
      .setMaxLength(MAX_PRODUCT_NAME_LENGTH),
  )
  .addStringOption((option) =>
    option
      .setName("script_url")
      .setDescription("Script URL baru")
      .setRequired(false)
      .setMaxLength(MAX_SCRIPT_URL_LENGTH),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

async function execute(interaction) {
  const productName = interaction.options.getString("product").trim();

  const newNameInput = interaction.options.getString("name");

  const newScriptUrlInput = interaction.options.getString("script_url");

  /*
  |--------------------------------------------------------------------------
  | Validate Changes
  |--------------------------------------------------------------------------
  */

  const hasNameChange = newNameInput !== null;

  const hasUrlChange = newScriptUrlInput !== null;

  if (!hasNameChange && !hasUrlChange) {
    return interaction.reply({
      content:
        "Masukkan minimal satu perubahan:\n" + "`name` atau `script_url`.",
      ephemeral: true,
    });
  }

  /*
  |--------------------------------------------------------------------------
  | Find Product
  |--------------------------------------------------------------------------
  */

  const product = db
    .prepare(
      `
        SELECT
          id,
          name,
          script_url,
          status
        FROM products
        WHERE LOWER(name) = LOWER(?)
      `,
    )
    .get(productName);

  if (!product) {
    return interaction.reply({
      content: `Product \`${productName}\` tidak ditemukan.`,
      ephemeral: true,
    });
  }

  /*
  |--------------------------------------------------------------------------
  | Validate New Name
  |--------------------------------------------------------------------------
  */

  let finalName = product.name;

  if (hasNameChange) {
    const trimmedName = newNameInput.trim();

    if (
      trimmedName.length < 1 ||
      trimmedName.length > MAX_PRODUCT_NAME_LENGTH
    ) {
      return interaction.reply({
        content: `Nama product harus memiliki 1-${MAX_PRODUCT_NAME_LENGTH} karakter.`,
        ephemeral: true,
      });
    }

    const existingName = db
      .prepare(
        `
          SELECT id
          FROM products
          WHERE LOWER(name) = LOWER(?)
          AND id != ?
        `,
      )
      .get(trimmedName, product.id);

    if (existingName) {
      return interaction.reply({
        content: `Product \`${trimmedName}\` sudah ada.`,
        ephemeral: true,
      });
    }

    finalName = trimmedName;
  }

  /*
  |--------------------------------------------------------------------------
  | Validate New Script URL
  |--------------------------------------------------------------------------
  */

  let finalScriptUrl = product.script_url;

  if (hasUrlChange) {
    const trimmedUrl = newScriptUrlInput.trim();

    if (trimmedUrl.length < 1 || trimmedUrl.length > MAX_SCRIPT_URL_LENGTH) {
      return interaction.reply({
        content: `Script URL harus memiliki 1-${MAX_SCRIPT_URL_LENGTH} karakter.`,
        ephemeral: true,
      });
    }

    let parsedUrl;

    try {
      parsedUrl = new URL(trimmedUrl);
    } catch {
      return interaction.reply({
        content: "Script URL tidak valid.",
        ephemeral: true,
      });
    }

    if (parsedUrl.protocol !== "https:") {
      return interaction.reply({
        content: "Script URL harus menggunakan HTTPS.",
        ephemeral: true,
      });
    }

    if (parsedUrl.username || parsedUrl.password) {
      return interaction.reply({
        content: "Script URL tidak boleh mengandung username atau password.",
        ephemeral: true,
      });
    }

    finalScriptUrl = parsedUrl.toString();
  }

  /*
  |--------------------------------------------------------------------------
  | Update Product
  |--------------------------------------------------------------------------
  */

  try {
    db.prepare(
      `
        UPDATE products
        SET
          name = ?,
          script_url = ?
        WHERE id = ?
      `,
    ).run(finalName, finalScriptUrl, product.id);
  } catch (error) {
    console.error("Edit Product Database Error:", error);

    return interaction.reply({
      content: "Terjadi kesalahan saat memperbarui product.",
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
      "Product berhasil diperbarui.\n\n" +
      `Old Name: \`${product.name}\`\n` +
      `New Name: \`${finalName}\`\n\n` +
      `Script URL: \`${finalScriptUrl}\``,
    ephemeral: true,
  });
}

/*
|--------------------------------------------------------------------------
| Autocomplete
|--------------------------------------------------------------------------
*/

async function autocomplete(interaction) {
  const focusedValue =
    interaction.options.getString("product")?.trim().toLowerCase() || "";

  const products = db
    .prepare(
      `
        SELECT name
        FROM products
        WHERE LOWER(name) LIKE ?
        ORDER BY name ASC
        LIMIT 25
      `,
    )
    .all(`%${focusedValue}%`);

  return interaction.respond(
    products.map((product) => ({
      name: product.name,
      value: product.name,
    })),
  );
}

module.exports = {
  command,
  execute,
  autocomplete,
};
