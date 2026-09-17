const {
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

const db = require("../database/database");

async function execute(interaction) {
  const guild = interaction.guild;
  const user = interaction.user;

  if (!guild) {
    return interaction.reply({
      content: "Fitur ini hanya dapat digunakan di server.",
      ephemeral: true,
    });
  }

  const setting = db
    .prepare(
      `
        SELECT value
        FROM settings
        WHERE key = 'ticket_category_id'
    `,
    )
    .get();

  if (!setting) {
    return interaction.reply({
      content: "Ticket category belum diatur oleh admin.",
      ephemeral: true,
    });
  }

  const category = guild.channels.cache.get(setting.value);

  if (!category || category.type !== ChannelType.GuildCategory) {
    return interaction.reply({
      content:
        "Ticket category tidak ditemukan. " +
        "Admin perlu mengatur ulang ticket category.",
      ephemeral: true,
    });
  }

  const existingTicket = guild.channels.cache.find(
    (channel) =>
      channel.type === ChannelType.GuildText &&
      channel.parentId === category.id &&
      channel.topic === `Tzockey Ticket | ${user.id}`,
  );

  if (existingTicket) {
    return interaction.reply({
      content: `Kamu sudah memiliki ticket: ${existingTicket}`,
      ephemeral: true,
    });
  }

  const channelName = `ticket-${user.username}`
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .slice(0, 80);

  const ticketChannel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: category.id,
    topic: `Tzockey Ticket | ${user.id}`,

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

  const embed = new EmbedBuilder()
    .setTitle("Access Request")
    .setDescription(
      `Welcome, ${user}.\n\n` +
        "Ticket kamu berhasil dibuat.\n" +
        "Silakan tunggu admin untuk melanjutkan proses access.",
    )
    .addFields({
      name: "User",
      value: `${user}`,
      inline: true,
    })
    .setFooter({
      text: "Tzockey Access System",
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
    content: `Ticket berhasil dibuat: ${ticketChannel}`,
    ephemeral: true,
  });
}

module.exports = {
  execute,
};
