const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

const db = require("../database/database");

function formatDuration(seconds) {
  if (!seconds || seconds <= 0) {
    return "0s";
  }

  let remaining = Math.floor(seconds);

  const days = Math.floor(remaining / 86400);

  remaining %= 86400;

  const hours = Math.floor(remaining / 3600);

  remaining %= 3600;

  const minutes = Math.floor(remaining / 60);

  const secs = remaining % 60;

  const parts = [];

  if (days > 0) {
    parts.push(`${days}d`);
  }

  if (hours > 0) {
    parts.push(`${hours}h`);
  }

  if (minutes > 0) {
    parts.push(`${minutes}m`);
  }

  if (secs > 0 || parts.length === 0) {
    parts.push(`${secs}s`);
  }

  return parts.join(" ");
}

function formatRemaining(expiresAt, status) {
  if (status === "Expired") {
    return "Expired";
  }

  if (!expiresAt) {
    return "Tidak ada";
  }

  const remaining = expiresAt - Date.now();

  if (remaining <= 0) {
    return "Expired";
  }

  return formatDuration(Math.floor(remaining / 1000));
}

function buildKeyEmbed(keyData) {
  const originalDuration = Number(keyData.duration_seconds || 0);

  const extendedDuration = Number(keyData.extended_seconds || 0);

  const totalDuration = originalDuration + extendedDuration;

  return new EmbedBuilder()
    .setTitle("Tzockey Key")
    .addFields(
      {
        name: "Key",
        value: `\`${keyData.key}\``,
        inline: false,
      },
      {
        name: "Product",
        value: keyData.product_name,
        inline: true,
      },
      {
        name: "Plan",
        value: keyData.plan,
        inline: true,
      },
      {
        name: "Status",
        value: `\`${keyData.status}\``,
        inline: true,
      },
      {
        name: "Original Duration",
        value: `\`${formatDuration(originalDuration)}\``,
        inline: true,
      },
      {
        name: "Extended Time",
        value: `\`${formatDuration(extendedDuration)}\``,
        inline: true,
      },
      {
        name: "Total Duration",
        value: `\`${formatDuration(totalDuration)}\``,
        inline: true,
      },
      {
        name: "Expires",
        value: keyData.expires_at
          ? `<t:${Math.floor(keyData.expires_at / 1000)}:F>`
          : "Tidak ada",
        inline: false,
      },
      {
        name: "Remaining",
        value: `\`${formatRemaining(keyData.expires_at, keyData.status)}\``,
        inline: true,
      },
    )
    .setTimestamp();
}

const command = new SlashCommandBuilder()
  .setName("my-keys")
  .setDescription("Melihat key yang terhubung dengan akun Discord");

async function execute(interaction) {
  const userId = interaction.user.id;

  const now = Date.now();

  /*
  |--------------------------------------------------------------------------
  | Expire Old Keys
  |--------------------------------------------------------------------------
  */

  const expireKeys = db.transaction(() => {
    const expiredKeys = db
      .prepare(
        `
              SELECT id
              FROM keys
              WHERE discord_id = ?
              AND status = 'Active'
              AND expires_at IS NOT NULL
              AND expires_at <= ?
            `,
      )
      .all(userId, now);

    if (expiredKeys.length === 0) {
      return;
    }

    for (const keyData of expiredKeys) {
      db.prepare(
        `
            UPDATE keys
            SET status = 'Expired'
            WHERE id = ?
          `,
      ).run(keyData.id);

      db.prepare(
        `
            DELETE FROM sessions
            WHERE key_id = ?
          `,
      ).run(keyData.id);
    }
  });

  try {
    expireKeys();
  } catch (error) {
    console.error("My Keys Expire Error:", error);

    return interaction.reply({
      content: "Terjadi kesalahan saat memperbarui status key.",
      ephemeral: true,
    });
  }

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
        ORDER BY keys.id DESC
      `,
    )
    .all(userId);

  if (keys.length === 0) {
    return interaction.reply({
      content: "Kamu tidak punya key.\n\n" + "Dapatkan access terlebih dahulu.",
      ephemeral: true,
    });
  }

  /*
  |--------------------------------------------------------------------------
  | Build Embeds
  |--------------------------------------------------------------------------
  */

  const embeds = [];
  const components = [];

  for (const keyData of keys.slice(0, 10)) {
    embeds.push(buildKeyEmbed(keyData));

    if (keyData.status === "Expired") {
      components.push(
        new ButtonBuilder()
          .setCustomId(`tzockey_renew_${keyData.id}`)
          .setLabel("Renew Access")
          .setStyle(ButtonStyle.Primary),
      );
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Build Button Rows
  |--------------------------------------------------------------------------
  */

  const rows = [];

  for (let i = 0; i < components.length; i += 5) {
    rows.push(new ActionRowBuilder().addComponents(components.slice(i, i + 5)));
  }

  /*
  |--------------------------------------------------------------------------
  | Response
  |--------------------------------------------------------------------------
  */

  return interaction.reply({
    embeds,
    components: rows,
    ephemeral: true,
  });
}

module.exports = {
  command,
  execute,
  showMyKeys: execute,
};
