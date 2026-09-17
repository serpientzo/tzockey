const { PermissionFlagsBits } = require("discord.js");

async function execute(interaction) {
  const channel = interaction.channel;
  const member = interaction.member;

  if (!channel || !channel.topic) {
    return interaction.reply({
      content: "Channel ini bukan ticket Tzockey.",
      ephemeral: true,
    });
  }

  const match = channel.topic.match(/^Tzockey Ticket \| (\d+)$/);

  if (!match) {
    return interaction.reply({
      content: "Channel ini bukan ticket Tzockey.",
      ephemeral: true,
    });
  }

  const isAdmin =
    member && member.permissions.has(PermissionFlagsBits.Administrator);

  if (!isAdmin) {
    return interaction.reply({
      content: "Hanya Administrator yang dapat menutup ticket.",
      ephemeral: true,
    });
  }

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
