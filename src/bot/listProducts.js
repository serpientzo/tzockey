const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");

const db = require("../database/database");

const command = new SlashCommandBuilder()
  .setName("list-products")
  .setDescription("Melihat semua product Tzockey")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

async function execute(interaction) {
  let products;

  try {
    products = db
      .prepare(
        `
          SELECT
            id,
            name,
            status,
            script_url
          FROM products
          ORDER BY id ASC
        `,
      )
      .all();
  } catch (error) {
    console.error("List Products Database Error:", error);

    return interaction.reply({
      content: "Terjadi kesalahan saat mengambil daftar product.",
      ephemeral: true,
    });
  }

  if (products.length === 0) {
    return interaction.reply({
      content: "Belum ada product.",
      ephemeral: true,
    });
  }

  const list = products
    .map((product) => {
      return (
        `**${product.id}. ${product.name}**\n` +
        `Status: \`${product.status}\`\n` +
        `URL: \`${product.script_url}\``
      );
    })
    .join("\n\n");

  return interaction.reply({
    content: `**Tzockey Products**\n\n${list}`,
    ephemeral: true,
  });
}

module.exports = {
  command,
  execute,
};
