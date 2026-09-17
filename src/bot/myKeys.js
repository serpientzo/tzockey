const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

const db = require("../database/database");

function formatRemaining(milliseconds) {
  if (milliseconds <= 0) {
    return "Expired";
  }

  const totalSeconds = Math.floor(milliseconds / 1000);

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

  if (seconds > 0) {
    parts.push(`${seconds}s`);
  }

  return parts.join(" ");
}

const command = new SlashCommandBuilder()
  .setName("my-keys")
  .setDescription("Melihat key Tzockey milik kamu");

async function execute(interaction) {
  return showMyKeys(interaction);
}

async function showMyKeys(interaction) {
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
        ORDER BY keys.created_at DESC
        LIMIT 1
    `,
    )
    .get(discordId);

  if (!keyData) {
    return interaction.reply({
      content: "Kamu belum memiliki key.",
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

  const remaining = keyData.expires_at
    ? formatRemaining(keyData.expires_at - Date.now())
    : "N/A";

  const embed = new EmbedBuilder()
    .setTitle("My Key")
    .setDescription("Informasi key Tzockey kamu.")
    .addFields(
      {
        name: "Product",
        value: `\`${keyData.product_name}\``,
        inline: true,
      },
      {
        name: "Plan",
        value: `\`${keyData.plan}\``,
        inline: true,
      },
      {
        name: "Status",
        value: `\`${keyData.status}\``,
        inline: true,
      },
      {
        name: "Key",
        value: `\`${keyData.key}\``,
        inline: false,
      },
      {
        name: "Expires",
        value: keyData.expires_at
          ? `<t:${Math.floor(keyData.expires_at / 1000)}:F>`
          : "N/A",
        inline: true,
      },
      {
        name: "Remaining",
        value: `\`${remaining}\``,
        inline: true,
      },
      {
        name: "HWID",
        value: keyData.hwid ? `\`${keyData.hwid}\`` : "Not registered",
        inline: false,
      },
    )
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
  command,
  execute,
  showMyKeys,
};
