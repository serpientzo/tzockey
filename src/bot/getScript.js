const { EmbedBuilder } = require("discord.js");

const db = require("../database/database");

async function execute(interaction) {
  const discordId = interaction.user.id;

  const keyData = db
    .prepare(
      `
        SELECT
            keys.*,
            products.name AS product_name,
            products.status AS product_status
        FROM keys
        JOIN products
            ON products.id = keys.product_id
        WHERE keys.discord_id = ?
        AND keys.status = 'Active'
        ORDER BY keys.created_at DESC
        LIMIT 1
    `,
    )
    .get(discordId);

  if (!keyData) {
    return interaction.reply({
      content:
        "Kamu belum memiliki access aktif.\n\n" + "Redeem key terlebih dahulu.",
      ephemeral: true,
    });
  }

  if (keyData.expires_at && Date.now() >= keyData.expires_at) {
    db.prepare(
      `
            UPDATE keys
            SET status = 'Expired'
            WHERE id = ?
        `,
    ).run(keyData.id);

    return interaction.reply({
      content: "Access kamu sudah expired.",
      ephemeral: true,
    });
  }

  if (keyData.product_status !== "Active") {
    return interaction.reply({
      content: "Product dari access kamu sedang tidak aktif.",
      ephemeral: true,
    });
  }

  const loaderSetting = db
    .prepare(
      `
        SELECT value
        FROM settings
        WHERE key = 'loader_url'
    `,
    )
    .get();

  if (!loaderSetting) {
    return interaction.reply({
      content: "Loader belum dikonfigurasi oleh admin.",
      ephemeral: true,
    });
  }

  const loaderUrl = loaderSetting.value;

  const loadstring = `loadstring(game:HttpGet("${loaderUrl}"))()`;

  const embed = new EmbedBuilder()
    .setTitle("Get Script")
    .setDescription(
      "Access kamu valid.\n\n" +
        `Product: \`${keyData.product_name}\`\n` +
        `Expires: <t:${Math.floor(keyData.expires_at / 1000)}:F>\n\n` +
        "Gunakan loader di bawah untuk menjalankan script.",
    )
    .addFields({
      name: "Loader",
      value: "```lua\n" + loadstring + "\n```",
    })
    .setFooter({
      text: "Tzockey Access System",
    })
    .setTimestamp();

  return interaction.reply({
    embeds: [embed],
    ephemeral: true,
  });
}

module.exports = {
  execute,
};
