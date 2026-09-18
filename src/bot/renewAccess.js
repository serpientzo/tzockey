const {
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

const db = require("../database/database");

async function execute(interaction, keyId) {
  const guild = interaction.guild;
  const user = interaction.user;

  if (!guild) {
    return interaction.reply({
      content: "Fitur ini hanya dapat digunakan di server.",
      ephemeral: true,
    });
  }

  if (!keyId) {
    return interaction.reply({
      content: "Key tidak valid.",
      ephemeral: true,
    });
  }

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
        WHERE keys.id = ?
          AND keys.discord_id = ?
      `,
    )
    .get(keyId, user.id);

  if (!keyData) {
    return interaction.reply({
      content: "Key tidak ditemukan atau bukan milik kamu.",
      ephemeral: true,
    });
  }

  // Pastikan expiry benar-benar sudah lewat.
  if (
    keyData.status === "Active" &&
    keyData.expires_at &&
    keyData.expires_at <= Date.now()
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

  if (keyData.status !== "Expired") {
    return interaction.reply({
      content: "Renewal hanya dapat dilakukan untuk key yang sudah expired.",
      ephemeral: true,
    });
  }

  const setting = db
    .prepare(
      `
      SELECT value
      FROM settings
      WHERE key = 'renewal_category_id'
    `,
    )
    .get();

  if (!setting) {
    return interaction.reply({
      content: "Renewal ticket category belum diatur oleh admin.",
      ephemeral: true,
    });
  }

  const category = guild.channels.cache.get(setting.value);

  if (!category || category.type !== ChannelType.GuildCategory) {
    return interaction.reply({
      content:
        "Renewal ticket category tidak ditemukan. " +
        "Admin perlu mengatur ulang renewal ticket category.",
      ephemeral: true,
    });
  }

  const topic = `Tzockey Renewal | ${user.id} | ${keyData.id}`;

  const existingTicket = guild.channels.cache.find(
    (channel) =>
      channel.type === ChannelType.GuildText &&
      channel.parentId === category.id &&
      channel.topic === topic,
  );

  if (existingTicket) {
    return interaction.reply({
      content: `Kamu sudah memiliki renewal ticket: ${existingTicket}`,
      ephemeral: true,
    });
  }

  const channelName = `renew-${user.username}-${keyData.id}`
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .slice(0, 80);

  const ticketChannel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: category.id,
    topic,

    permissionOverwrites: [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionFlagsBits.ViewChannel],
      },
      {
        id: user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
        ],
      },
    ],
  });

  const originalDuration = keyData.duration_seconds || 0;
  const extendedDuration = keyData.extended_seconds || 0;
  const totalDuration = originalDuration + extendedDuration;

  const embed = new EmbedBuilder()
    .setTitle("Renewal Request")
    .setDescription(
      `Welcome, ${user}.\n\n` +
        "Renewal ticket kamu berhasil dibuat.\n" +
        "Silakan tunggu admin untuk melanjutkan proses renewal access.",
    )
    .addFields(
      {
        name: "User",
        value: `${user}`,
        inline: true,
      },
      {
        name: "Product",
        value: keyData.product_name,
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
        name: "Expired",
        value: keyData.expires_at
          ? `<t:${Math.floor(keyData.expires_at / 1000)}:F>`
          : "Tidak ada",
        inline: false,
      },
    )
    .setFooter({
      text: "Tzockey Renewal System",
    })
    .setTimestamp();

  const closeButton = new ButtonBuilder()
    .setCustomId("tzockey_close_ticket")
    .setLabel("Close Ticket")
    .setStyle(ButtonStyle.Danger);

  const row = new ActionRowBuilder().addComponents(closeButton);

  await ticketChannel.send({
    embeds: [embed],
    components: [row],
  });

  await interaction.reply({
    content: `Renewal ticket berhasil dibuat: ${ticketChannel}`,
    ephemeral: true,
  });
}

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

module.exports = {
  execute,
};
