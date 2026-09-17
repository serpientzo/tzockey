require("dotenv").config();

require("../database/database");

const { Client, GatewayIntentBits } = require("discord.js");

const generateKey = require("./generateKey");
const redeemKey = require("./redeemKey");
const deleteKey = require("./deleteKey");
const myKeys = require("./myKeys");
const resetHwid = require("./resetHwid");
const adminResetHwid = require("./adminResetHwid");
const addProduct = require("./addProduct");
const listProducts = require("./listProducts");
const disableKey = require("./disableKey");
const enableKey = require("./enableKey");
const keyInfo = require("./keyInfo");
const listKeys = require("./listKeys");
const editProduct = require("./editProduct");
const disableProduct = require("./disableProduct");
const enableProduct = require("./enableProduct");
const deleteProduct = require("./deleteProduct");
const panel = require("./panel");
const setTicketCategory = require("./setTicketCategory");
const access = require("./access");
const closeTicket = require("./closeTicket");
const getScript = require("./getScript");
const setLoaderUrl = require("./setLoaderUrl");
const getLoader = require("./getLoader");
const loaderInfo = require("./loaderInfo");

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once("ready", () => {
  console.log(`Tzockey aktif sebagai ${client.user.tag}`);
});

client.on("interactionCreate", async (interaction) => {
  if (interaction.isAutocomplete()) {
    if (interaction.commandName === "generate-key") {
      try {
        await generateKey.autocomplete(interaction);
      } catch (error) {
        console.error("Generate Key Autocomplete Error:", error);
      }
    }

    if (interaction.commandName === "list-keys") {
      try {
        await listKeys.autocomplete(interaction);
      } catch (error) {
        console.error("List Keys Autocomplete Error:", error);
      }
    }

    if (interaction.commandName === "edit-product") {
      try {
        await editProduct.autocomplete(interaction);
      } catch (error) {
        console.error("Edit Product Autocomplete Error:", error);
      }
    }

    if (interaction.commandName === "disable-product") {
      try {
        await disableProduct.autocomplete(interaction);
      } catch (error) {
        console.error("Disable Product Autocomplete Error:", error);
      }
    }

    if (interaction.commandName === "enable-product") {
      try {
        await enableProduct.autocomplete(interaction);
      } catch (error) {
        console.error("Enable Product Autocomplete Error:", error);
      }
    }

    if (interaction.commandName === "delete-product") {
      try {
        await deleteProduct.autocomplete(interaction);
      } catch (error) {
        console.error("Delete Product Autocomplete Error:", error);
      }
    }

    return;
  }

  if (interaction.isButton()) {
    if (interaction.customId === "tzockey_redeem") {
      try {
        await redeemKey.showRedeemModal(interaction);
      } catch (error) {
        console.error("Redeem Button Error:", error);

        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: "Terjadi kesalahan saat membuka Redeem Key.",
            ephemeral: true,
          });
        }
      }
    }

    if (interaction.customId === "tzockey_my_keys") {
      try {
        await myKeys.showMyKeys(interaction);
      } catch (error) {
        console.error("My Keys Button Error:", error);

        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: "Terjadi kesalahan saat mengambil informasi key.",
            ephemeral: true,
          });
        }
      }
    }

    if (interaction.customId === "tzockey_reset_hwid") {
      try {
        await resetHwid.execute(interaction);
      } catch (error) {
        console.error("Reset HWID Button Error:", error);

        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: "Terjadi kesalahan saat reset HWID.",
            ephemeral: true,
          });
        }
      }
    }

    if (interaction.customId === "tzockey_access") {
      try {
        await access.execute(interaction);
      } catch (error) {
        console.error("Access Button Error:", error);

        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: "Terjadi kesalahan saat membuat ticket.",
            ephemeral: true,
          });
        }
      }
    }

    if (interaction.customId === "tzockey_close_ticket") {
      try {
        await closeTicket.execute(interaction);
      } catch (error) {
        console.error("Close Ticket Button Error:", error);

        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: "Terjadi kesalahan saat menutup ticket.",
            ephemeral: true,
          });
        }
      }
    }

    if (interaction.customId === "tzockey_script") {
      try {
        await getScript.execute(interaction);
      } catch (error) {
        console.error("Get Script Button Error:", error);

        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: "Terjadi kesalahan saat memeriksa access.",
            ephemeral: true,
          });
        }
      }
    }

    return;
  }

  if (interaction.isModalSubmit()) {
    if (interaction.customId === "tzockey_redeem_modal") {
      try {
        await redeemKey.handleModal(interaction);
      } catch (error) {
        console.error("Redeem Modal Error:", error);

        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: "Terjadi kesalahan saat redeem key.",
            ephemeral: true,
          });
        }
      }
    }

    return;
  }

  if (!interaction.isChatInputCommand()) {
    return;
  }

  if (interaction.commandName === "generate-key") {
    try {
      await generateKey.execute(interaction);
    } catch (error) {
      console.error("Generate Key Error:", error);

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: "❌ Terjadi kesalahan saat membuat key.",
          ephemeral: true,
        });
      } else {
        await interaction.reply({
          content: "❌ Terjadi kesalahan saat membuat key.",
          ephemeral: true,
        });
      }
    }
  }

  if (interaction.commandName === "redeem-key") {
    try {
      await redeemKey.execute(interaction);
    } catch (error) {
      console.error("Redeem Key Error:", error);

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: "❌ Terjadi kesalahan saat redeem key.",
          ephemeral: true,
        });
      } else {
        await interaction.reply({
          content: "❌ Terjadi kesalahan saat redeem key.",
          ephemeral: true,
        });
      }
    }
  }

  if (interaction.commandName === "delete-key") {
    try {
      await deleteKey.execute(interaction);
    } catch (error) {
      console.error("Delete Key Error:", error);

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: "❌ Terjadi kesalahan saat menghapus key.",
          ephemeral: true,
        });
      } else {
        await interaction.reply({
          content: "❌ Terjadi kesalahan saat menghapus key.",
          ephemeral: true,
        });
      }
    }
  }

  if (interaction.commandName === "my-keys") {
    try {
      await myKeys.execute(interaction);
    } catch (error) {
      console.error("My Keys Error:", error);

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: "❌ Terjadi kesalahan saat mengambil data key.",
          ephemeral: true,
        });
      } else {
        await interaction.reply({
          content: "❌ Terjadi kesalahan saat mengambil data key.",
          ephemeral: true,
        });
      }
    }
  }

  if (interaction.commandName === "reset-hwid") {
    try {
      await resetHwid.execute(interaction);
    } catch (error) {
      console.error("Reset HWID Error:", error);

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: "❌ Terjadi kesalahan saat reset HWID.",
          ephemeral: true,
        });
      } else {
        await interaction.reply({
          content: "❌ Terjadi kesalahan saat reset HWID.",
          ephemeral: true,
        });
      }
    }
  }

  if (interaction.commandName === "admin-reset-hwid") {
    try {
      await adminResetHwid.execute(interaction);
    } catch (error) {
      console.error("Admin Reset HWID Error:", error);

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: "❌ Terjadi kesalahan saat admin reset HWID.",
          ephemeral: true,
        });
      } else {
        await interaction.reply({
          content: "❌ Terjadi kesalahan saat admin reset HWID.",
          ephemeral: true,
        });
      }
    }
  }

  if (interaction.commandName === "add-product") {
    try {
      await addProduct.execute(interaction);
    } catch (error) {
      console.error("Add Product Error:", error);

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: "❌ Terjadi kesalahan saat menambahkan product.",
          ephemeral: true,
        });
      } else {
        await interaction.reply({
          content: "❌ Terjadi kesalahan saat menambahkan product.",
          ephemeral: true,
        });
      }
    }
  }

  if (interaction.commandName === "list-products") {
    try {
      await listProducts.execute(interaction);
    } catch (error) {
      console.error("List Products Error:", error);

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: "❌ Terjadi kesalahan saat mengambil daftar product.",
          ephemeral: true,
        });
      } else {
        await interaction.reply({
          content: "❌ Terjadi kesalahan saat mengambil daftar product.",
          ephemeral: true,
        });
      }
    }
  }

  if (interaction.commandName === "edit-product") {
    try {
      await editProduct.execute(interaction);
    } catch (error) {
      console.error("Edit Product Error:", error);

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: "❌ Terjadi kesalahan saat mengubah product.",
          ephemeral: true,
        });
      } else {
        await interaction.reply({
          content: "❌ Terjadi kesalahan saat mengubah product.",
          ephemeral: true,
        });
      }
    }
  }

  if (interaction.commandName === "disable-product") {
    try {
      await disableProduct.execute(interaction);
    } catch (error) {
      console.error("Disable Product Error:", error);

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: "❌ Terjadi kesalahan saat menonaktifkan product.",
          ephemeral: true,
        });
      } else {
        await interaction.reply({
          content: "❌ Terjadi kesalahan saat menonaktifkan product.",
          ephemeral: true,
        });
      }
    }
  }

  if (interaction.commandName === "enable-product") {
    try {
      await enableProduct.execute(interaction);
    } catch (error) {
      console.error("Enable Product Error:", error);

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: "❌ Terjadi kesalahan saat mengaktifkan product.",
          ephemeral: true,
        });
      } else {
        await interaction.reply({
          content: "❌ Terjadi kesalahan saat mengaktifkan product.",
          ephemeral: true,
        });
      }
    }
  }

  if (interaction.commandName === "delete-product") {
    try {
      await deleteProduct.execute(interaction);
    } catch (error) {
      console.error("Delete Product Error:", error);

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: "❌ Terjadi kesalahan saat menghapus product.",
          ephemeral: true,
        });
      } else {
        await interaction.reply({
          content: "❌ Terjadi kesalahan saat menghapus product.",
          ephemeral: true,
        });
      }
    }
  }

  if (interaction.commandName === "disable-key") {
    try {
      await disableKey.execute(interaction);
    } catch (error) {
      console.error("Disable Key Error:", error);

      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "❌ Terjadi error saat menonaktifkan key.",
          ephemeral: true,
        });
      }
    }

    return;
  }

  if (interaction.commandName === "enable-key") {
    try {
      await enableKey.execute(interaction);
    } catch (error) {
      console.error("Enable Key Error:", error);

      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "❌ Terjadi error saat mengaktifkan key.",
          ephemeral: true,
        });
      }
    }

    return;
  }

  if (interaction.commandName === "key-info") {
    try {
      await keyInfo.execute(interaction);
    } catch (error) {
      console.error("Key Info Error:", error);

      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "❌ Terjadi error saat mengambil informasi key.",
          ephemeral: true,
        });
      }
    }

    return;
  }

  if (interaction.commandName === "list-keys") {
    try {
      await listKeys.execute(interaction);
    } catch (error) {
      console.error("List Keys Error:", error);

      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "❌ Terjadi error saat mengambil daftar key.",
          ephemeral: true,
        });
      }
    }

    return;
  }

  if (interaction.commandName === "panel") {
    try {
      await panel.execute(interaction);
    } catch (error) {
      console.error("Panel Error:", error);

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: "Terjadi kesalahan saat mengirim panel.",
          ephemeral: true,
        });
      } else {
        await interaction.reply({
          content: "Terjadi kesalahan saat mengirim panel.",
          ephemeral: true,
        });
      }
    }
  }

  if (interaction.commandName === "set-ticket-category") {
    try {
      await setTicketCategory.execute(interaction);
    } catch (error) {
      console.error("Set Ticket Category Error:", error);

      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "Terjadi kesalahan saat mengatur ticket category.",
          ephemeral: true,
        });
      }
    }

    return;
  }

  if (interaction.commandName === "set-loader-url") {
    try {
      await setLoaderUrl.execute(interaction);
    } catch (error) {
      console.error("Set Loader URL Error:", error);

      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "Terjadi kesalahan saat mengatur loader URL.",
          ephemeral: true,
        });
      }
    }

    return;
  }

  if (interaction.commandName === "get-loader") {
    try {
      await getLoader.execute(interaction);
    } catch (error) {
      console.error("Get Loader Error:", error);

      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "Terjadi kesalahan saat mengambil loader.",
          ephemeral: true,
        });
      }
    }

    return;
  }

  if (interaction.commandName === "loader-info") {
    try {
      await loaderInfo.execute(interaction);
    } catch (error) {
      console.error("Loader Info Error:", error);

      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "Terjadi kesalahan saat mengambil informasi loader.",
          ephemeral: true,
        });
      }
    }

    return;
  }
});

client.login(process.env.DISCORD_TOKEN);
