const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

const PRICING = [
  { duration: "1 Day", price: "Rp7.000" },
  { duration: "3 Days", price: "Rp15.000" },
  { duration: "7 Days", price: "Rp25.000" },
  { duration: "14 Days", price: "Rp40.000" },
  { duration: "30 Days", price: "Rp60.000" },
];

const command = new SlashCommandBuilder()
  .setName("panel")
  .setDescription("Mengirim Tzockey buyer panel")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

async function execute(interaction) {
  const pricingText = PRICING.map(
    (item) => `**${item.duration}**  •  ${item.price}`,
  ).join("\n");

  const container = new ContainerBuilder()
    .setAccentColor(0x2b2d31)

    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        "# Tzockey\n" +
          "Welcome to Tzockey.\n\n" +
          "Manage your access, redeem your key, " +
          "and retrieve your loader from this panel.",
      ),
    )

    .addSeparatorComponents(new SeparatorBuilder())

    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        "## Access Pricing\n\n" + pricingText,
      ),
    )

    .addSeparatorComponents(new SeparatorBuilder())

    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        "## Getting Started\n\n" +
          "Use **Redeem Key** if you already have a key.\n" +
          "Use **Access** if you want to request access.",
      ),
    )

    .addSeparatorComponents(new SeparatorBuilder())

    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("tzockey_access")
          .setLabel("Access")
          .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
          .setCustomId("tzockey_redeem")
          .setLabel("Redeem Key")
          .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
          .setCustomId("tzockey_my_keys")
          .setLabel("My Keys")
          .setStyle(ButtonStyle.Secondary),

        new ButtonBuilder()
          .setCustomId("tzockey_script")
          .setLabel("Get Script")
          .setStyle(ButtonStyle.Primary),
      ),
    )

    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("tzockey_reset_hwid")
          .setLabel("Reset HWID")
          .setStyle(ButtonStyle.Danger),
      ),
    );

  await interaction.channel.send({
    flags: MessageFlags.IsComponentsV2,
    components: [container],
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
