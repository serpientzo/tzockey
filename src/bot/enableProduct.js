const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");

const db = require("../database/database");

const command = new SlashCommandBuilder()
  .setName("enable-product")
  .setDescription("Mengaktifkan kembali Tzockey product")
  .addStringOption((option) =>
    option
      .setName("product")
      .setDescription("Product yang ingin diaktifkan")
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

  if (product.status === "Active") {
    return interaction.reply({
      content: `⚠️ Product \`${product.name}\` sudah Active.`,
      ephemeral: true,
    });
  }

  db.prepare(
    `
        UPDATE products
        SET status = 'Active'
        WHERE id = ?
    `,
  ).run(product.id);

  await interaction.reply({
    content:
      `🟢 **Product berhasil diaktifkan!**\n\n` +
      `Product: \`${product.name}\`\n` +
      `Status: \`Active\``,
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
