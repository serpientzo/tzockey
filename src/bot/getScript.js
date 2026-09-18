const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

const db = require("../database/database");

async function execute(interaction) {
  const discordId = interaction.user.id;

  /*
  |--------------------------------------------------------------------------
  | Get User Keys
  |--------------------------------------------------------------------------
  */

  const keys = db
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
        ORDER BY keys.created_at DESC
      `,
    )
    .all(discordId);

  if (keys.length === 0) {
    return interaction.reply({
      content: "Kamu belum memiliki key.\n\n" + "Redeem key terlebih dahulu.",
      ephemeral: true,
    });
  }

  /*
  |--------------------------------------------------------------------------
  | Expire Keys
  |--------------------------------------------------------------------------
  */

  const now = Date.now();

  const expireKeys = db.transaction(() => {
    for (const keyData of keys) {
      if (
        keyData.status === "Active" &&
        keyData.expires_at &&
        now >= keyData.expires_at
      ) {
        db.prepare(
          `
              UPDATE keys
              SET status = 'Expired'
              WHERE id = ?
              AND status = 'Active'
            `,
        ).run(keyData.id);

        db.prepare(
          `
              DELETE FROM sessions
              WHERE key_id = ?
            `,
        ).run(keyData.id);

        keyData.status = "Expired";
      }
    }
  });

  try {
    expireKeys();
  } catch (error) {
    console.error("Get Script Expire Error:", error);

    return interaction.reply({
      content: "Terjadi kesalahan saat memperbarui status key.",
      ephemeral: true,
    });
  }

  /*
  |--------------------------------------------------------------------------
  | Find Active Key
  |--------------------------------------------------------------------------
  */

  const activeKey = keys.find((keyData) => keyData.status === "Active");

  /*
  |--------------------------------------------------------------------------
  | No Active Key
  |--------------------------------------------------------------------------
  */

  if (!activeKey) {
    const disabledKey = keys.find((keyData) => keyData.status === "Disabled");

    if (disabledKey) {
      return interaction.reply({
        content: "Key yang kamu miliki sedang disabled.",
        ephemeral: true,
      });
    }

    const expiredKey = keys.find((keyData) => keyData.status === "Expired");

    if (expiredKey) {
      const renewButton = new ButtonBuilder()
        .setCustomId(`tzockey_renew_${expiredKey.id}`)
        .setLabel("Renew Access")
        .setStyle(ButtonStyle.Primary);

      const row = new ActionRowBuilder().addComponents(renewButton);

      return interaction.reply({
        content:
          "Access kamu sudah expired.\n\n" +
          "Renew access untuk memperpanjang masa aktif key kamu.",
        components: [row],
        ephemeral: true,
      });
    }

    return interaction.reply({
      content:
        "Kamu tidak punya key yang aktif.\n\n" +
        "Redeem key jika kamu sudah memiliki key.",
      ephemeral: true,
    });
  }

  /*
  |--------------------------------------------------------------------------
  | Validate Product
  |--------------------------------------------------------------------------
  */

  if (activeKey.product_status !== "Active") {
    return interaction.reply({
      content: "Product dari access kamu sedang tidak aktif.",
      ephemeral: true,
    });
  }

  /*
  |--------------------------------------------------------------------------
  | Get Loader URL
  |--------------------------------------------------------------------------
  */

  const loaderSetting = db
    .prepare(
      `
          SELECT value
          FROM settings
          WHERE key = 'loader_url'
        `,
    )
    .get();

  if (!loaderSetting || !loaderSetting.value) {
    return interaction.reply({
      content: "Loader belum dikonfigurasi oleh admin.",
      ephemeral: true,
    });
  }

  const loaderUrl = loaderSetting.value.trim();

  /*
  |--------------------------------------------------------------------------
  | Validate Loader URL
  |--------------------------------------------------------------------------
  */

  let parsedLoaderUrl;

  try {
    parsedLoaderUrl = new URL(loaderUrl);
  } catch {
    return interaction.reply({
      content: "Loader URL tidak valid. Hubungi admin.",
      ephemeral: true,
    });
  }

  if (parsedLoaderUrl.protocol !== "https:") {
    return interaction.reply({
      content: "Loader URL harus menggunakan HTTPS.",
      ephemeral: true,
    });
  }

  if (parsedLoaderUrl.username || parsedLoaderUrl.password) {
    return interaction.reply({
      content: "Loader URL tidak valid. Hubungi admin.",
      ephemeral: true,
    });
  }

  /*
  |--------------------------------------------------------------------------
  | Build Loader
  |--------------------------------------------------------------------------
  */

  const loadstring = `loadstring(game:HttpGet("${parsedLoaderUrl.toString()}"))()`;

  const embed = new EmbedBuilder()
    .setTitle("Get Script")
    .setDescription(
      "Access kamu valid.\n\n" +
        `Product: \`${activeKey.product_name}\`\n` +
        `Expires: <t:${Math.floor(activeKey.expires_at / 1000)}:F>\n\n` +
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

  /*
  |--------------------------------------------------------------------------
  | Response
  |--------------------------------------------------------------------------
  */

  return interaction.reply({
    embeds: [embed],
    ephemeral: true,
  });
}

module.exports = {
  execute,
};
