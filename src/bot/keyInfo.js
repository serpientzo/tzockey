const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} = require("discord.js");

const db = require("../database/database");

const MAX_RESETS = 3;

function formatUser(discordId) {
  if (!discordId) {
    return "Belum di-redeem";
  }

  return `<@${discordId}>`;
}

function formatHwid(hwid) {
  if (!hwid) {
    return "Belum terdaftar";
  }

  return `\`${hwid}\``;
}

function formatDate(timestamp) {
  if (!timestamp) {
    return "Tidak ada";
  }

  return `<t:${Math.floor(timestamp / 1000)}:F>`;
}

function formatDuration(seconds) {
  const totalSeconds = Number(seconds);

  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return "0s";
  }

  let remaining = Math.floor(totalSeconds);

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

const command = new SlashCommandBuilder()
  .setName("key-info")
  .setDescription("Melihat informasi lengkap sebuah Tzockey key")
  .addStringOption((option) =>
    option
      .setName("key")
      .setDescription("Key yang ingin diperiksa")
      .setRequired(true),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

async function execute(interaction) {
  const key = interaction.options.getString("key").trim().toUpperCase();

  /*
  |--------------------------------------------------------------------------
  | Find Key
  |--------------------------------------------------------------------------
  */

  const keyData = db
    .prepare(
      `
        SELECT
          keys.id,
          keys.key,
          keys.product_id,
          keys.plan,
          keys.duration_seconds,
          keys.extended_seconds,
          keys.created_at,
          keys.expires_at,
          keys.discord_id,
          keys.hwid,
          keys.status,
          keys.reset_count,
          products.name AS product_name,
          products.status AS product_status
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

  /*
  |--------------------------------------------------------------------------
  | Expire Key
  |--------------------------------------------------------------------------
  */

  const now = Date.now();

  if (
    keyData.status === "Active" &&
    keyData.expires_at &&
    now >= keyData.expires_at
  ) {
    try {
      const expireKey = db.transaction(() => {
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
      });

      expireKey();

      keyData.status = "Expired";
    } catch (error) {
      console.error("Key Info Expire Error:", error);

      return interaction.reply({
        content: "Terjadi kesalahan saat memperbarui status key.",
        ephemeral: true,
      });
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Duration
  |--------------------------------------------------------------------------
  */

  const originalDuration = Number(keyData.duration_seconds || 0);

  const extendedDuration = Number(keyData.extended_seconds || 0);

  const totalDuration = originalDuration + extendedDuration;

  const resetCount = Number(keyData.reset_count || 0);

  /*
  |--------------------------------------------------------------------------
  | Build Embed
  |--------------------------------------------------------------------------
  */

  const embed = new EmbedBuilder()
    .setTitle("Tzockey Key Information")
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
        name: "Product Status",
        value: `\`${keyData.product_status}\``,
        inline: true,
      },
      {
        name: "Plan",
        value: `\`${keyData.plan}\``,
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
        name: "Status",
        value: `\`${keyData.status}\``,
        inline: true,
      },
      {
        name: "Discord",
        value: formatUser(keyData.discord_id),
        inline: true,
      },
      {
        name: "Reset Count",
        value: `\`${resetCount}/${MAX_RESETS}\``,
        inline: true,
      },
      {
        name: "HWID",
        value: formatHwid(keyData.hwid),
        inline: false,
      },
      {
        name: "Created",
        value: formatDate(keyData.created_at),
        inline: true,
      },
      {
        name: "Expires",
        value: formatDate(keyData.expires_at),
        inline: true,
      },
      {
        name: "Remaining",
        value: `\`${formatRemaining(keyData.expires_at, keyData.status)}\``,
        inline: true,
      },
    )
    .setTimestamp();

  return interaction.reply({
    embeds: [embed],
    ephemeral: true,
  });
}

module.exports = {
  command,
  execute,
};
