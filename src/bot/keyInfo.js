const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} = require("discord.js");

const db = require("../database/database");

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

function formatRemaining(expiresAt) {
  if (!expiresAt) {
    return "Tidak ada";
  }

  const remaining = expiresAt - Date.now();

  if (remaining <= 0) {
    return "Expired";
  }

  const totalSeconds = Math.floor(remaining / 1000);

  const days = Math.floor(totalSeconds / 86400);

  const hours = Math.floor((totalSeconds % 86400) / 3600);

  const minutes = Math.floor((totalSeconds % 3600) / 60);

  const seconds = totalSeconds % 60;

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

  if (seconds > 0 || parts.length === 0) {
    parts.push(`${seconds}s`);
  }

  return parts.join(" ");
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
        WHERE keys.key = ?
    `,
    )
    .get(key);

  if (!keyData) {
    return interaction.reply({
      content: "❌ Key tidak ditemukan.",
      ephemeral: true,
    });
  }

  if (
    keyData.status === "Active" &&
    keyData.expires_at &&
    Date.now() >= keyData.expires_at
  ) {
    db.prepare(
      `
            UPDATE keys
            SET status = 'Expired'
            WHERE id = ?
        `,
    ).run(keyData.id);

    keyData.status = "Expired";
  }

  const embed = new EmbedBuilder()
    .setTitle("🔑 Tzockey Key Information")
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
        value: keyData.product_status,
        inline: true,
      },
      {
        name: "Plan",
        value: keyData.plan,
        inline: true,
      },
      {
        name: "Duration Seconds",
        value: `\`${keyData.duration_seconds}\``,
        inline: true,
      },
      {
        name: "Status",
        value: keyData.status,
        inline: true,
      },
      {
        name: "Discord",
        value: formatUser(keyData.discord_id),
        inline: true,
      },
      {
        name: "Reset Count",
        value: `${keyData.reset_count}/3`,
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
        value: formatRemaining(keyData.expires_at),
        inline: true,
      },
    )
    .setTimestamp();

  await interaction.reply({
    embeds: [embed],
    ephemeral: true,
  });
}

module.exports = {
  command,
  execute,
};
