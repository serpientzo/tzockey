const {
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

const db = require("../database/database");

function createTicketChannelName(user) {
  const username = user.username
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 70);

  if (!username) {
    return `ticket-${user.id}`;
  }

  return `ticket-${username}`;
}

async function execute(interaction) {
  const guild = interaction.guild;
  const user = interaction.user;

  /*
  |--------------------------------------------------------------------------
  | Server Check
  |--------------------------------------------------------------------------
  */

  if (!guild) {
    return interaction.reply({
      content: "Fitur ini hanya dapat digunakan di server.",
      ephemeral: true,
    });
  }

  /*
  |--------------------------------------------------------------------------
  | Get Ticket Category
  |--------------------------------------------------------------------------
  */

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
        "Ticket category tidak ditemukan.\n\n" +
        "Admin perlu mengatur ulang ticket category.",
      ephemeral: true,
    });
  }

  /*
  |--------------------------------------------------------------------------
  | Check Existing Ticket
  |--------------------------------------------------------------------------
  */

  const ticketTopic = `Tzockey Ticket | ${user.id}`;

  const existingTicket = guild.channels.cache.find(
    (channel) =>
      channel.type === ChannelType.GuildText &&
      channel.parentId === category.id &&
      channel.topic === ticketTopic,
  );

  if (existingTicket) {
    return interaction.reply({
      content: `Kamu sudah memiliki ticket: ${existingTicket}`,
      ephemeral: true,
    });
  }

  /*
  |--------------------------------------------------------------------------
  | Create Ticket Channel
  |--------------------------------------------------------------------------
  */

  const channelName = createTicketChannelName(user);

  let ticketChannel;

  try {
    ticketChannel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: category.id,
      topic: ticketTopic,

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
  } catch (error) {
    console.error("Access Ticket Create Error:", error);

    return interaction.reply({
      content:
        "Ticket gagal dibuat.\n\n" +
        "Pastikan bot memiliki permission untuk membuat dan mengatur channel.",
      ephemeral: true,
    });
  }

  /*
  |--------------------------------------------------------------------------
  | Ticket Message
  |--------------------------------------------------------------------------
  */

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

  try {
    await ticketChannel.send({
      embeds: [embed],
      components: [row],
    });
  } catch (error) {
    console.error("Access Ticket Message Error:", error);

    try {
      await ticketChannel.delete("Gagal mengirim pesan ticket");
    } catch (deleteError) {
      console.error("Access Ticket Cleanup Error:", deleteError);
    }

    return interaction.reply({
      content: "Ticket gagal disiapkan.",
      ephemeral: true,
    });
  }

  /*
  |--------------------------------------------------------------------------
  | Response
  |--------------------------------------------------------------------------
  */

  return interaction.reply({
    content: `Ticket berhasil dibuat: ${ticketChannel}`,
    ephemeral: true,
  });
}

module.exports = {
  execute,
};
