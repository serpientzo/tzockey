const {
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} = require("discord.js");

const db = require("../database/database");

const MAX_RESETS = 3;

const command = new SlashCommandBuilder()
  .setName("reset-hwid")
  .setDescription("Reset HWID pada key aktif kamu")
  .addStringOption((option) =>
    option
      .setName("key")
      .setDescription("Key aktif yang ingin di-reset HWID-nya")
      .setRequired(true),
  );

function resetKeyHwid(discordId, key) {
  const keyData = db
    .prepare(
      `
        SELECT *
        FROM keys
        WHERE key = ?
        AND discord_id = ?
      `,
    )
    .get(key, discordId);

  if (!keyData) {
    return {
      success: false,
      message: "Key tidak ditemukan atau key tersebut bukan milik kamu.",
    };
  }

  if (keyData.status === "Disabled") {
    return {
      success: false,
      message: "Key kamu sedang disabled.",
    };
  }

  if (keyData.status !== "Active") {
    return {
      success: false,
      message:
        "Key kamu tidak dapat di-reset.\n\n" + `Status: \`${keyData.status}\``,
    };
  }

  const now = Date.now();

  /*
  |--------------------------------------------------------------------------
  | Check Expiration
  |--------------------------------------------------------------------------
  */

  if (keyData.expires_at && now >= keyData.expires_at) {
    const expireKey = db.transaction(() => {
      db.prepare(
        `
            UPDATE keys
            SET status = 'Expired'
            WHERE id = ?
          `,
      ).run(keyData.id);

      db.prepare(
        `
            DELETE FROM sessions
            WHERE key_id = ?
          `,
      ).run(keyData.id);
    });

    expireKey();

    return {
      success: false,
      message: "Key kamu sudah expired.",
    };
  }

  /*
  |--------------------------------------------------------------------------
  | Check HWID
  |--------------------------------------------------------------------------
  */

  if (!keyData.hwid) {
    return {
      success: false,
      message: "Key kamu belum memiliki HWID.",
    };
  }

  /*
  |--------------------------------------------------------------------------
  | Check Reset Limit
  |--------------------------------------------------------------------------
  */

  const resetCount = Number(keyData.reset_count || 0);

  if (!Number.isInteger(resetCount) || resetCount < 0) {
    return {
      success: false,
      message: "Reset count key tidak valid. Hubungi admin.",
    };
  }

  if (resetCount >= MAX_RESETS) {
    return {
      success: false,
      message:
        "Batas reset HWID sudah tercapai.\n\n" +
        `Batas reset: ${MAX_RESETS} kali\n` +
        `Reset digunakan: ${resetCount} kali\n\n` +
        "Hubungi admin jika kamu perlu melakukan reset lagi.",
    };
  }

  const newResetCount = resetCount + 1;

  /*
  |--------------------------------------------------------------------------
  | Reset HWID
  |--------------------------------------------------------------------------
  */

  try {
    const resetHwid = db.transaction(() => {
      db.prepare(
        `
            DELETE FROM sessions
            WHERE key_id = ?
          `,
      ).run(keyData.id);

      db.prepare(
        `
            UPDATE keys
            SET
              hwid = NULL,
              reset_count = ?
            WHERE id = ?
            AND status = 'Active'
          `,
      ).run(newResetCount, keyData.id);
    });

    resetHwid();
  } catch (error) {
    console.error("Reset HWID Database Error:", error);

    return {
      success: false,
      message: "Terjadi kesalahan saat reset HWID.",
    };
  }

  return {
    success: true,
    message:
      "HWID berhasil di-reset.\n\n" +
      `Key: \`${keyData.key}\`\n` +
      `Reset Count: \`${newResetCount}/${MAX_RESETS}\`\n\n` +
      "HWID baru akan didaftarkan ketika kamu menjalankan script kembali.",
  };
}

async function execute(interaction) {
  const discordId = interaction.user.id;

  const key = interaction.options.getString("key").trim().toUpperCase();

  const result = resetKeyHwid(discordId, key);

  return interaction.reply({
    content: result.message,
    ephemeral: true,
  });
}

async function showResetModal(interaction) {
  const modal = new ModalBuilder()
    .setCustomId("tzockey_reset_hwid_modal")
    .setTitle("Reset HWID");

  const keyInput = new TextInputBuilder()
    .setCustomId("tzockey_reset_hwid_key")
    .setLabel("Tzockey Key")
    .setPlaceholder("TZK-XXXX-XXXX-XXXX-XXXX")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(100);

  const row = new ActionRowBuilder().addComponents(keyInput);

  modal.addComponents(row);

  await interaction.showModal(modal);
}

async function handleModal(interaction) {
  const discordId = interaction.user.id;

  const key = interaction.fields
    .getTextInputValue("tzockey_reset_hwid_key")
    .trim()
    .toUpperCase();

  const result = resetKeyHwid(discordId, key);

  return interaction.reply({
    content: result.message,
    ephemeral: true,
  });
}

module.exports = {
  command,
  execute,
  showResetModal,
  handleModal,
};
