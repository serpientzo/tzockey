const { PermissionFlagsBits } = require("discord.js");

async function execute(interaction) {
  const channel = interaction.channel;

  const member = interaction.member;

  /*
  |--------------------------------------------------------------------------
  | Validate Channel
  |--------------------------------------------------------------------------
  */

  if (!channel || !channel.topic) {
    return interaction.reply({
      content: "Channel ini bukan ticket Tzockey.",
      ephemeral: true,
    });
  }

  /*
  |--------------------------------------------------------------------------
  | Validate Ticket Type
  |--------------------------------------------------------------------------
  */

  const isAccessTicket = /^Tzockey Ticket \| (\d+)$/.test(channel.topic);

  const isRenewalTicket = /^Tzockey Renewal \| (\d+) \| (\d+)$/.test(
    channel.topic,
  );

  if (!isAccessTicket && !isRenewalTicket) {
    return interaction.reply({
      content: "Channel ini bukan ticket Tzockey.",
      ephemeral: true,
    });
  }

  /*
  |--------------------------------------------------------------------------
  | Administrator Check
  |--------------------------------------------------------------------------
  */

  const isAdmin =
    member && member.permissions.has(PermissionFlagsBits.Administrator);

  if (!isAdmin) {
    return interaction.reply({
      content: "Hanya Administrator yang dapat menutup ticket.",
      ephemeral: true,
    });
  }

  /*
  |--------------------------------------------------------------------------
  | Close Ticket
  |--------------------------------------------------------------------------
  */

  await interaction.reply({
    content: "Ticket akan ditutup dalam 5 detik.",
  });

  setTimeout(async () => {
    try {
      await channel.delete("Tzockey ticket closed");
    } catch (error) {
      console.error("Close Ticket Delete Error:", error);
    }
  }, 5000);
}

module.exports = {
  execute,
};
