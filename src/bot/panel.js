const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

const PRICING = [
  { duration: "1 Day", price: "Rp.7.000" },
  { duration: "3 Days", price: "Rp.15.000" },
  { duration: "7 Days", price: "Rp.25.000" },
  { duration: "14 Days", price: "Rp.40.000" },
  { duration: "30 Days", price: "Rp.60.000" },
];

const command = new SlashCommandBuilder()
  .setName("panel")
  .setDescription("Mengirim Tzockey buyer panel")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

async function execute(interaction) {
  const pricingText = PRICING.map(
    (item) => `**${item.duration}**  •  ${item.price}`,
  ).join("\n");

  const embed = new EmbedBuilder()
    .setTitle("Tzockey")
    .setDescription(
      "Welcome to Tzockey.\n\n" +
        "Manage your access, redeem your key, " +
        "and retrieve your loader from this panel.",
    )
    .addFields(
      {
        name: "Access Pricing",
        value: pricingText,
        inline: false,
      },
      {
        name: "Getting Started",
        value:
          "Use **Redeem Key** if you already have a key.\n" +
          "Use **Access** if you want to request access.",
        inline: false,
      },
    )
    .setFooter({
      text: "Tzockey Access System",
    })
    .setTimestamp();

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("tzockey_access")
      .setLabel("Access")
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId("tzockey_redeem")
      .setLabel("Redeem Key")
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId("tzockey_script")
      .setLabel("Get Script")
      .setStyle(ButtonStyle.Secondary),
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("tzockey_reset_hwid")
      .setLabel("Reset HWID")
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId("tzockey_my_keys")
      .setLabel("My Keys")
      .setStyle(ButtonStyle.Secondary),
  );

  await interaction.channel.send({
    embeds: [embed],
    components: [row1, row2],
  });

  await interaction.reply({
    content: "Buyer panel berhasil dikirim.",
    ephemeral: true,
  });
}

module.exports = {
  command,
  execute,
};
