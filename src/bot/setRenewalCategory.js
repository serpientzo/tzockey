const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
} = require("discord.js");

const db = require("../database/database");

const command = new SlashCommandBuilder()
  .setName("set-renewal-category")
  .setDescription("Mengatur category untuk renewal ticket")
  .addChannelOption((option) =>
    option
      .setName("category")
      .setDescription("Category yang digunakan untuk renewal ticket")
      .addChannelTypes(ChannelType.GuildCategory)
      .setRequired(true),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

async function execute(interaction) {
  const category = interaction.options.getChannel("category");

  db.prepare(
    `
      INSERT INTO settings (key, value)
      VALUES ('renewal_category_id', ?)
      ON CONFLICT(key)
      DO UPDATE SET value = excluded.value
    `,
  ).run(category.id);

  await interaction.reply({
    content: `Renewal ticket category berhasil diatur ke ${category}.`,
    ephemeral: true,
  });
}

module.exports = {
  command,
  execute,
};
