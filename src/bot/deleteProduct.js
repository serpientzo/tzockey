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

  const product = db
    .prepare(
      `
        SELECT *
        FROM products
        WHERE LOWER(name) = LOWER(?)
    `,
    )
    .get(productName);

  if (!product) {
    return interaction.reply({
      content: `❌ Product \`${productName}\` tidak ditemukan.`,
      ephemeral: true,
    });
  }

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
        `❌ **Product tidak dapat dihapus.**\n\n` +
        `Product: \`${product.name}\`\n` +
        `Keys terkait: \`${keyCount.count}\`\n\n` +
        `Kelola atau hapus key tersebut terlebih dahulu.`,
      ephemeral: true,
    });
  }

  db.prepare(
    `
        DELETE FROM products
        WHERE id = ?
    `,
  ).run(product.id);

  await interaction.reply({
    content:
      `🗑️ **Product berhasil dihapus!**\n\n` + `Product: \`${product.name}\``,
    ephemeral: true,
  });
}

async function autocomplete(interaction) {
  const focusedValue = interaction.options.getString("product").toLowerCase();

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

  await interaction.respond(
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
