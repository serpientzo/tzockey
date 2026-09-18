const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require("discord.js");

const db = require("../database/database");

const KEYS_PER_PAGE = 10;

function formatDuration(seconds) {
  const totalSeconds = Number(seconds);

  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return "0s";
  }

  let remaining = Math.floor(totalSeconds);

  const days = Math.floor(remaining / 86400);

  remaining %= 86400;

  const hours = Math.floor(remaining / 3600);

  remaining %= 3600;

  const minutes = Math.floor(remaining / 60);

  const secs = remaining % 60;

  const parts = [];

  if (days > 0) {
    parts.push(`${days}d`);
  }

  if (hours > 0) {
    parts.push(`${hours}h`);
  }

  if (minutes > 0) {
    parts.push(`${minutes}m`);
  }

  if (secs > 0 || parts.length === 0) {
    parts.push(`${secs}s`);
  }

  return parts.join(" ");
}

function formatRemaining(expiresAt, status) {
  if (status === "Expired") {
    return "Expired";
  }

  if (!expiresAt) {
    return "Tidak ada";
  }

  const remaining = expiresAt - Date.now();

  if (remaining <= 0) {
    return "Expired";
  }

  return formatDuration(Math.floor(remaining / 1000));
}

function buildEmbed(keys, page, totalPages, status, productName, search) {
  const startIndex = page * KEYS_PER_PAGE;

  const pageKeys = keys.slice(startIndex, startIndex + KEYS_PER_PAGE);

  const embed = new EmbedBuilder()
    .setTitle("Tzockey Keys")
    .setDescription(
      `Menampilkan ${pageKeys.length} dari ${keys.length} key.\n` +
        `Halaman ${page + 1}/${totalPages}` +
        (status ? `\nStatus: \`${status}\`` : "") +
        (productName ? `\nProduct: \`${productName}\`` : "") +
        (search ? `\nSearch: \`${search}\`` : ""),
    )
    .setTimestamp();

  for (const keyData of pageKeys) {
    const originalDuration = Number(keyData.duration_seconds || 0);

    const extendedDuration = Number(keyData.extended_seconds || 0);

    const totalDuration = originalDuration + extendedDuration;

    const discord = keyData.discord_id
      ? `<@${keyData.discord_id}>`
      : "Belum di-redeem";

    const expires = keyData.expires_at
      ? `<t:${Math.floor(keyData.expires_at / 1000)}:F>`
      : "Tidak ada";

    const remaining = formatRemaining(keyData.expires_at, keyData.status);

    embed.addFields({
      name: `Key: ${keyData.key}`,
      value:
        `Product: \`${keyData.product_name}\`\n` +
        `Plan: \`${keyData.plan}\`\n` +
        `Status: \`${keyData.status}\`\n` +
        `User: ${discord}\n` +
        `Original Duration: \`${formatDuration(originalDuration)}\`\n` +
        `Extended Time: \`${formatDuration(extendedDuration)}\`\n` +
        `Total Duration: \`${formatDuration(totalDuration)}\`\n` +
        `Expires: ${expires}\n` +
        `Remaining: \`${remaining}\``,
      inline: false,
    });
  }

  return embed;
}

function buildButtons(page, totalPages, disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("tzockey_list_keys_previous")
      .setLabel("Previous")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled || page === 0),

    new ButtonBuilder()
      .setCustomId("tzockey_list_keys_next")
      .setLabel("Next")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled || page >= totalPages - 1),
  );
}

const command = new SlashCommandBuilder()
  .setName("list-keys")
  .setDescription("Melihat daftar Tzockey key")
  .addStringOption((option) =>
    option
      .setName("status")
      .setDescription("Filter berdasarkan status")
      .setRequired(false)
      .addChoices(
        {
          name: "Unused",
          value: "Unused",
        },
        {
          name: "Active",
          value: "Active",
        },
        {
          name: "Expired",
          value: "Expired",
        },
        {
          name: "Disabled",
          value: "Disabled",
        },
      ),
  )
  .addStringOption((option) =>
    option
      .setName("product")
      .setDescription("Filter berdasarkan product")
      .setRequired(false)
      .setAutocomplete(true),
  )
  .addStringOption((option) =>
    option
      .setName("search")
      .setDescription("Cari berdasarkan key atau Discord User ID")
      .setRequired(false),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

async function execute(interaction) {
  const status = interaction.options.getString("status");

  const productName = interaction.options.getString("product");

  const search = interaction.options.getString("search");

  const now = Date.now();

  /*
  |--------------------------------------------------------------------------
  | Expire Active Keys
  |--------------------------------------------------------------------------
  */

  try {
    const expireKeys = db.transaction(() => {
      const expiredKeys = db
        .prepare(
          `
                SELECT id
                FROM keys
                WHERE status = 'Active'
                AND expires_at IS NOT NULL
                AND expires_at <= ?
              `,
        )
        .all(now);

      for (const keyData of expiredKeys) {
        db.prepare(
          `
              UPDATE keys
              SET status = 'Expired'
              WHERE id = ?
              AND status = 'Active'
            `,
        ).run(keyData.id);

        db.prepare(
          `
              DELETE FROM sessions
              WHERE key_id = ?
            `,
        ).run(keyData.id);
      }
    });

    expireKeys();
  } catch (error) {
    console.error("List Keys Expire Error:", error);

    return interaction.reply({
      content: "Terjadi kesalahan saat memperbarui status key.",
      ephemeral: true,
    });
  }

  /*
  |--------------------------------------------------------------------------
  | Build Query
  |--------------------------------------------------------------------------
  */

  let query = `
    SELECT
      keys.id,
      keys.key,
      keys.product_id,
      keys.plan,
      keys.duration_seconds,
      keys.extended_seconds,
      keys.created_at,
      keys.expires_at,
      keys.discord_id,
      keys.hwid,
      keys.status,
      keys.reset_count,
      products.name AS product_name,
      products.status AS product_status
    FROM keys
    JOIN products
      ON products.id = keys.product_id
  `;

  const conditions = [];
  const params = [];

  if (status) {
    conditions.push("keys.status = ?");

    params.push(status);
  }

  if (productName) {
    conditions.push("LOWER(products.name) = LOWER(?)");

    params.push(productName.trim());
  }

  if (search) {
    const searchValue = search.trim();

    if (searchValue) {
      conditions.push(
        `
          (
            LOWER(keys.key) LIKE LOWER(?)
            OR keys.discord_id = ?
          )
        `,
      );

      params.push(`%${searchValue}%`, searchValue);
    }
  }

  if (conditions.length > 0) {
    query += ` WHERE ${conditions.join(" AND ")}`;
  }

  query += `
    ORDER BY keys.id DESC
  `;

  /*
  |--------------------------------------------------------------------------
  | Get Keys
  |--------------------------------------------------------------------------
  */

  let keys;

  try {
    keys = db.prepare(query).all(...params);
  } catch (error) {
    console.error("List Keys Query Error:", error);

    return interaction.reply({
      content: "Terjadi kesalahan saat mengambil daftar key.",
      ephemeral: true,
    });
  }

  if (keys.length === 0) {
    return interaction.reply({
      content: "Tidak ada key yang ditemukan.",
      ephemeral: true,
    });
  }

  /*
  |--------------------------------------------------------------------------
  | Pagination
  |--------------------------------------------------------------------------
  */

  const totalPages = Math.ceil(keys.length / KEYS_PER_PAGE);

  let page = 0;

  const embed = buildEmbed(keys, page, totalPages, status, productName, search);

  const components = totalPages > 1 ? [buildButtons(page, totalPages)] : [];

  await interaction.reply({
    embeds: [embed],
    components,
    ephemeral: true,
  });

  if (totalPages <= 1) {
    return;
  }

  /*
  |--------------------------------------------------------------------------
  | Pagination Collector
  |--------------------------------------------------------------------------
  */

  const message = await interaction.fetchReply();

  const collector = message.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 5 * 60 * 1000,
  });

  collector.on("collect", async (buttonInteraction) => {
    if (buttonInteraction.user.id !== interaction.user.id) {
      return buttonInteraction.reply({
        content:
          "Pagination ini hanya dapat digunakan oleh admin yang menjalankan command.",
        ephemeral: true,
      });
    }

    if (buttonInteraction.customId === "tzockey_list_keys_previous") {
      page = Math.max(0, page - 1);
    }

    if (buttonInteraction.customId === "tzockey_list_keys_next") {
      page = Math.min(totalPages - 1, page + 1);
    }

    const updatedEmbed = buildEmbed(
      keys,
      page,
      totalPages,
      status,
      productName,
      search,
    );

    try {
      await buttonInteraction.update({
        embeds: [updatedEmbed],
        components: [buildButtons(page, totalPages)],
      });
    } catch (error) {
      console.error("List Keys Pagination Error:", error);
    }
  });

  /*
  |--------------------------------------------------------------------------
  | Collector End
  |--------------------------------------------------------------------------
  */

  collector.on("end", async () => {
    try {
      await interaction.editReply({
        components: [buildButtons(page, totalPages, true)],
      });
    } catch (error) {
      // Message sudah tidak tersedia.
    }
  });
}

async function autocomplete(interaction) {
  const focusedValue = interaction.options.getString("product").toLowerCase();

  const products = db
    .prepare(
      `
        SELECT name
        FROM products
        WHERE status = 'Active'
        AND LOWER(name) LIKE ?
        ORDER BY name ASC
        LIMIT 25
      `,
    )
    .all(`%${focusedValue}%`);

  await interaction.respond(
    products.map((product) => ({
      name: product.name,
      value: product.name,
    })),
  );
}

module.exports = {
  command,
  execute,
  autocomplete,
};
