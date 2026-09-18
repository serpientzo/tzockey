const {
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} = require("discord.js");

const db = require("../database/database");

const command = new SlashCommandBuilder()
  .setName("redeem-key")
  .setDescription("Redeem your Tzockey key")
  .addStringOption((option) =>
    option
      .setName("key")
      .setDescription("Masukkan Tzockey key kamu")
      .setRequired(true),
  );

function redeemKey(interaction, keyInput) {
  const key = keyInput.trim().toUpperCase();

  const discordId = interaction.user.id;

  if (!key) {
    return {
      success: false,
      message: "Key tidak boleh kosong.",
    };
  }

  const redeem = db.transaction(() => {
    /*
    |--------------------------------------------------------------------------
    | Find Submitted Key
    |--------------------------------------------------------------------------
    */

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
          WHERE keys.key = ?
        `,
      )
      .get(key);

    if (!keyData) {
      return {
        success: false,
        message: "Key tidak ditemukan.",
      };
    }

    /*
    |--------------------------------------------------------------------------
    | Validate Key Status
    |--------------------------------------------------------------------------
    */

    if (keyData.status !== "Unused") {
      return {
        success: false,
        message:
          "Key tidak dapat digunakan.\n\n" + `Status: \`${keyData.status}\``,
      };
    }

    /*
    |--------------------------------------------------------------------------
    | Validate Product
    |--------------------------------------------------------------------------
    */

    if (keyData.product_status !== "Active") {
      return {
        success: false,
        message: "Product dari key ini sedang tidak aktif.",
      };
    }

    /*
    |--------------------------------------------------------------------------
    | Validate Duration
    |--------------------------------------------------------------------------
    */

    const durationSeconds = Number(keyData.duration_seconds);

    if (!Number.isSafeInteger(durationSeconds) || durationSeconds <= 0) {
      return {
        success: false,
        message: "Durasi key tidak valid. Hubungi admin.",
      };
    }

    const durationMilliseconds = durationSeconds * 1000;

    if (!Number.isSafeInteger(durationMilliseconds)) {
      return {
        success: false,
        message: "Durasi key terlalu besar.",
      };
    }

    /*
    |--------------------------------------------------------------------------
    | Check Existing Active Key
    |--------------------------------------------------------------------------
    */

    const existingKey = db
      .prepare(
        `
          SELECT *
          FROM keys
          WHERE discord_id = ?
          AND status = 'Active'
          LIMIT 1
        `,
      )
      .get(discordId);

    const now = Date.now();

    if (existingKey) {
      if (existingKey.expires_at && existingKey.expires_at > now) {
        return {
          success: false,
          message: "Kamu masih memiliki key yang aktif.",
        };
      }

      /*
      | Existing key sudah expired.
      */

      db.prepare(
        `
          UPDATE keys
          SET status = 'Expired'
          WHERE id = ?
        `,
      ).run(existingKey.id);

      /*
      | Hapus session lama agar access
      | dari key expired tidak dapat digunakan.
      */

      db.prepare(
        `
          DELETE FROM sessions
          WHERE key_id = ?
        `,
      ).run(existingKey.id);
    }

    /*
    |--------------------------------------------------------------------------
    | Create New Expiration
    |--------------------------------------------------------------------------
    */

    const expiresAt = now + durationMilliseconds;

    if (!Number.isSafeInteger(expiresAt)) {
      return {
        success: false,
        message: "Tanggal expiration tidak valid.",
      };
    }

    /*
    |--------------------------------------------------------------------------
    | Activate Key
    |--------------------------------------------------------------------------
    */

    db.prepare(
      `
        UPDATE keys
        SET
          discord_id = ?,
          expires_at = ?,
          status = 'Active',
          hwid = NULL
        WHERE id = ?
        AND status = 'Unused'
      `,
    ).run(discordId, expiresAt, keyData.id);

    /*
    |--------------------------------------------------------------------------
    | Verify Update
    |--------------------------------------------------------------------------
    */

    const updatedKey = db
      .prepare(
        `
          SELECT status
          FROM keys
          WHERE id = ?
        `,
      )
      .get(keyData.id);

    if (!updatedKey || updatedKey.status !== "Active") {
      throw new Error("Key gagal diaktifkan.");
    }

    return {
      success: true,
      message:
        "Key berhasil di-redeem.\n\n" +
        `Product: \`${keyData.product_name}\`\n` +
        `Key: \`${keyData.key}\`\n` +
        `Plan: \`${keyData.plan}\`\n` +
        `Status: \`Active\`\n` +
        `Expires: <t:${Math.floor(expiresAt / 1000)}:F>`,
    };
  });

  return redeem();
}

async function execute(interaction) {
  const key = interaction.options.getString("key");

  try {
    const result = redeemKey(interaction, key);

    return interaction.reply({
      content: result.message,
      ephemeral: true,
    });
  } catch (error) {
    console.error("Redeem Key Error:", error);

    return interaction.reply({
      content: "Terjadi kesalahan saat redeem key.",
      ephemeral: true,
    });
  }
}

async function showRedeemModal(interaction) {
  const modal = new ModalBuilder()
    .setCustomId("tzockey_redeem_modal")
    .setTitle("Redeem Key");

  const keyInput = new TextInputBuilder()
    .setCustomId("key")
    .setLabel("Tzockey Key")
    .setPlaceholder("TZK-XXXX-XXXX-XXXX-XXXX")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMinLength(10)
    .setMaxLength(64);

  const row = new ActionRowBuilder().addComponents(keyInput);

  modal.addComponents(row);

  await interaction.showModal(modal);
}

async function handleModal(interaction) {
  const key = interaction.fields.getTextInputValue("key");

  try {
    const result = redeemKey(interaction, key);

    return interaction.reply({
      content: result.message,
      ephemeral: true,
    });
  } catch (error) {
    console.error("Redeem Key Modal Error:", error);

    return interaction.reply({
      content: "Terjadi kesalahan saat redeem key.",
      ephemeral: true,
    });
  }
}

module.exports = {
  command,
  execute,
  showRedeemModal,
  handleModal,
};
