const {
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} = require("discord.js");

const db = require("../database/database");

const command = new SlashCommandBuilder()
  .setName("redeem-key")
  .setDescription("Redeem your Tzockey key")
  .addStringOption((option) =>
    option
      .setName("key")
      .setDescription("Masukkan Tzockey key kamu")
      .setRequired(true),
  );

async function redeemKey(interaction, keyInput) {
  const key = keyInput.trim().toUpperCase();
  const discordId = interaction.user.id;

  const existingKey = db
    .prepare(
      `
        SELECT *
        FROM keys
        WHERE discord_id = ?
        AND status = 'Active'
        LIMIT 1
    `,
    )
    .get(discordId);

  if (existingKey) {
    if (existingKey.expires_at && Date.now() < existingKey.expires_at) {
      return interaction.reply({
        content: "Kamu masih memiliki key yang aktif.",
        ephemeral: true,
      });
    }

    db.prepare(
      `
        UPDATE keys
        SET status = 'Expired'
        WHERE id = ?
    `,
    ).run(existingKey.id);
  }

  const keyData = db
    .prepare(
      `
        SELECT
            keys.*,
            products.name AS product_name
        FROM keys
        JOIN products
            ON products.id = keys.product_id
        WHERE keys.key = ?
    `,
    )
    .get(key);

  if (!keyData) {
    return interaction.reply({
      content: "Key tidak ditemukan.",
      ephemeral: true,
    });
  }

  if (keyData.status !== "Unused") {
    return interaction.reply({
      content:
        `Key tidak dapat digunakan.\n\n` + `Status: \`${keyData.status}\``,
      ephemeral: true,
    });
  }

  const product = db
    .prepare(
      `
        SELECT *
        FROM products
        WHERE id = ?
        AND status = 'Active'
    `,
    )
    .get(keyData.product_id);

  if (!product) {
    return interaction.reply({
      content: "Product dari key ini sedang tidak aktif.",
      ephemeral: true,
    });
  }

  if (
    !Number.isInteger(keyData.duration_seconds) ||
    keyData.duration_seconds <= 0
  ) {
    return interaction.reply({
      content: "Durasi key tidak valid. Hubungi admin.",
      ephemeral: true,
    });
  }

  const now = Date.now();
  const expiresAt = now + keyData.duration_seconds * 1000;

  db.prepare(
    `
      UPDATE keys
      SET
          discord_id = ?,
          expires_at = ?,
          status = 'Active'
      WHERE id = ?
  `,
  ).run(discordId, expiresAt, keyData.id);

  return interaction.reply({
    content:
      `Key berhasil di-redeem.\n\n` +
      `Product: \`${product.name}\`\n` +
      `Key: \`${keyData.key}\`\n` +
      `Plan: \`${keyData.plan}\`\n` +
      `Status: \`Active\`\n` +
      `Expires: <t:${Math.floor(expiresAt / 1000)}:F>`,
    ephemeral: true,
  });
}

async function execute(interaction) {
  const key = interaction.options.getString("key");

  return redeemKey(interaction, key);
}

async function showRedeemModal(interaction) {
  const modal = new ModalBuilder()
    .setCustomId("tzockey_redeem_modal")
    .setTitle("Redeem Key");

  const keyInput = new TextInputBuilder()
    .setCustomId("key")
    .setLabel("Tzockey Key")
    .setPlaceholder("TZK-XXXX-XXXX-XXXX-XXXX")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMinLength(10)
    .setMaxLength(64);

  const row = new ActionRowBuilder().addComponents(keyInput);

  modal.addComponents(row);

  await interaction.showModal(modal);
}

async function handleModal(interaction) {
  const key = interaction.fields.getTextInputValue("key");

  return redeemKey(interaction, key);
}

module.exports = {
  command,
  execute,
  showRedeemModal,
  handleModal,
};
