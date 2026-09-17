const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");

const db = require("../database/database");

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
      .setRequired(false),
  )
  .addStringOption((option) =>
    option
      .setName("script_url")
      .setDescription("Script URL baru")
      .setRequired(false),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

async function execute(interaction) {
  const productName = interaction.options.getString("product").trim();

  const newName = interaction.options.getString("name");

  const newScriptUrl = interaction.options.getString("script_url");

  if (!newName && !newScriptUrl) {
    return interaction.reply({
      content:
        "❌ Masukkan minimal satu perubahan:\n" + "`name` atau `script_url`.",
      ephemeral: true,
    });
  }

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

  if (newName !== null) {
    const trimmedName = newName.trim();

    if (trimmedName.length < 1 || trimmedName.length > 100) {
      return interaction.reply({
        content: "❌ Nama product harus memiliki 1-100 karakter.",
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
        content: `❌ Product \`${trimmedName}\` sudah ada.`,
        ephemeral: true,
      });
    }
  }

  if (newScriptUrl !== null) {
    const trimmedUrl = newScriptUrl.trim();

    if (trimmedUrl.length > 2048) {
      return interaction.reply({
        content: "❌ Script URL terlalu panjang.",
        ephemeral: true,
      });
    }

    try {
      const url = new URL(trimmedUrl);

      if (url.protocol !== "https:" && url.protocol !== "http:") {
        return interaction.reply({
          content: "❌ Script URL harus menggunakan HTTP atau HTTPS.",
          ephemeral: true,
        });
      }
    } catch {
      return interaction.reply({
        content: "❌ Script URL tidak valid.",
        ephemeral: true,
      });
    }
  }

  const finalName = newName !== null ? newName.trim() : product.name;

  const finalScriptUrl =
    newScriptUrl !== null ? newScriptUrl.trim() : product.script_url;

  db.prepare(
    `
        UPDATE products
        SET
            name = ?,
            script_url = ?
        WHERE id = ?
    `,
  ).run(finalName, finalScriptUrl, product.id);

  await interaction.reply({
    content:
      `✅ **Product berhasil diperbarui!**\n\n` +
      `Old Name: \`${product.name}\`\n` +
      `New Name: \`${finalName}\`\n\n` +
      `Script URL: \`${finalScriptUrl}\``,
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
