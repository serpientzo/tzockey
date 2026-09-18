const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
} = require("discord.js");

const db = require("../database/database");

const command = new SlashCommandBuilder()
  .setName("set-ticket-category")
  .setDescription("Mengatur category untuk ticket Tzockey")
  .addChannelOption((option) =>
    option
      .setName("category")
      .setDescription("Pilih category tempat ticket dibuat")
      .setRequired(true)
      .addChannelTypes(ChannelType.GuildCategory),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

async function execute(interaction) {
  const category = interaction.options.getChannel("category");

  /*
  |--------------------------------------------------------------------------
  | Validate Category
  |--------------------------------------------------------------------------
  */

  if (!category || category.type !== ChannelType.GuildCategory) {
    return interaction.reply({
      content: "Category yang dipilih tidak valid.",
      ephemeral: true,
    });
  }

  /*
  |--------------------------------------------------------------------------
  | Save Setting
  |--------------------------------------------------------------------------
  */

  try {
    db.prepare(
      `
        INSERT INTO settings (
          key,
          value
        )
        VALUES (
          'ticket_category_id',
          ?
        )
        ON CONFLICT(key)
        DO UPDATE SET
          value = excluded.value
      `,
    ).run(category.id);
  } catch (error) {
    console.error("Set Ticket Category Database Error:", error);

    return interaction.reply({
      content: "Terjadi kesalahan saat menyimpan ticket category.",
      ephemeral: true,
    });
  }

  /*
  |--------------------------------------------------------------------------
  | Response
  |--------------------------------------------------------------------------
  */

  return interaction.reply({
    content: `Ticket category berhasil diatur ke ${category}.`,
    ephemeral: true,
  });
}

module.exports = {
  command,
  execute,
};
