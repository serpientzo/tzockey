const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");

const db = require("../database/database");

const command = new SlashCommandBuilder()
  .setName("delete-product")
  .setDescription("Menghapus Tzockey product")
  .addStringOption((option) =>
    option
      .setName("product")
      .setDescription("Product yang ingin dihapus")
      .setRequired(true)
      .setAutocomplete(true),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

async function execute(interaction) {
  const productName = interaction.options.getString("product").trim();

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
  | Check Related Keys
  |--------------------------------------------------------------------------
  */

  const keyCount = db
    .prepare(
      `
        SELECT COUNT(*) AS count
        FROM keys
        WHERE product_id = ?
      `,
    )
    .get(product.id);

  if (keyCount.count > 0) {
    return interaction.reply({
      content:
        "Product tidak dapat dihapus.\n\n" +
        `Product: \`${product.name}\`\n` +
        `Keys terkait: \`${keyCount.count}\`\n\n` +
        "Kelola atau hapus key tersebut terlebih dahulu.",
      ephemeral: true,
    });
  }

  /*
  |--------------------------------------------------------------------------
  | Delete Product
  |--------------------------------------------------------------------------
  */

  try {
    const result = db
      .prepare(
        `
          DELETE FROM products
          WHERE id = ?
        `,
      )
      .run(product.id);

    if (result.changes !== 1) {
      return interaction.reply({
        content: "Product gagal dihapus.",
        ephemeral: true,
      });
    }
  } catch (error) {
    console.error("Delete Product Database Error:", error);

    return interaction.reply({
      content: "Terjadi kesalahan saat menghapus product.",
      ephemeral: true,
    });
  }

  /*
  |--------------------------------------------------------------------------
  | Response
  |--------------------------------------------------------------------------
  */

  return interaction.reply({
    content: "Product berhasil dihapus.\n\n" + `Product: \`${product.name}\``,
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
