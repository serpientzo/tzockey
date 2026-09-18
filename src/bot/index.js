require("dotenv").config();

require("../api/server");

const { DISCORD_TOKEN } = require("../config");

require("../database/database");

const { Client, GatewayIntentBits } = require("discord.js");

/*
|--------------------------------------------------------------------------
| Commands
|--------------------------------------------------------------------------
*/

const generateKey = require("./generateKey");
const extendKey = require("./extendKey");
const redeemKey = require("./redeemKey");
const deleteKey = require("./deleteKey");
const myKeys = require("./myKeys");
const resetHwid = require("./resetHwid");
const adminResetHwid = require("./adminResetHwid");

const addProduct = require("./addProduct");
const listProducts = require("./listProducts");
const editProduct = require("./editProduct");
const disableProduct = require("./disableProduct");
const enableProduct = require("./enableProduct");
const deleteProduct = require("./deleteProduct");

const disableKey = require("./disableKey");
const enableKey = require("./enableKey");
const keyInfo = require("./keyInfo");
const listKeys = require("./listKeys");

const panel = require("./panel");

const setTicketCategory = require("./setTicketCategory");

const setRenewalCategory = require("./setRenewalCategory");

const access = require("./access");
const closeTicket = require("./closeTicket");

const getScript = require("./getScript");

const setLoaderUrl = require("./setLoaderUrl");

const getLoader = require("./getLoader");

const loaderInfo = require("./loaderInfo");

const renewAccess = require("./renewAccess");

/*
|--------------------------------------------------------------------------
| Discord Client
|--------------------------------------------------------------------------
*/

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

/*
|--------------------------------------------------------------------------
| Ready
|--------------------------------------------------------------------------
*/

client.once("ready", () => {
  console.log(`Tzockey aktif sebagai ${client.user.tag}`);
});

/*
|--------------------------------------------------------------------------
| Interaction Handler
|--------------------------------------------------------------------------
*/

client.on("interactionCreate", async (interaction) => {
  /*
    |--------------------------------------------------------------------------
    | Autocomplete
    |--------------------------------------------------------------------------
    */

  if (interaction.isAutocomplete()) {
    try {
      switch (interaction.commandName) {
        case "generate-key":
          await generateKey.autocomplete(interaction);
          break;

        case "list-keys":
          await listKeys.autocomplete(interaction);
          break;

        case "edit-product":
          await editProduct.autocomplete(interaction);
          break;

        case "disable-product":
          await disableProduct.autocomplete(interaction);
          break;

        case "enable-product":
          await enableProduct.autocomplete(interaction);
          break;

        case "delete-product":
          await deleteProduct.autocomplete(interaction);
          break;
      }
    } catch (error) {
      console.error("Autocomplete Error:", error);
    }

    return;
  }

  /*
    |--------------------------------------------------------------------------
    | Buttons
    |--------------------------------------------------------------------------
    */

  if (interaction.isButton()) {
    try {
      switch (true) {
        case interaction.customId === "tzockey_redeem":
          await redeemKey.showRedeemModal(interaction);
          break;

        case interaction.customId === "tzockey_my_keys":
          await myKeys.showMyKeys(interaction);
          break;

        case interaction.customId === "tzockey_reset_hwid":
          await resetHwid.showResetModal(interaction);
          break;

        case interaction.customId === "tzockey_access":
          await access.execute(interaction);
          break;

        case interaction.customId === "tzockey_close_ticket":
          await closeTicket.execute(interaction);
          break;

        case interaction.customId === "tzockey_script":
          await getScript.execute(interaction);
          break;

        case interaction.customId.startsWith("tzockey_renew_"): {
          const keyId = interaction.customId.replace("tzockey_renew_", "");

          await renewAccess.execute(interaction, keyId);

          break;
        }
      }
    } catch (error) {
      console.error("Button Interaction Error:", error);

      if (!interaction.replied && !interaction.deferred) {
        try {
          await interaction.reply({
            content: "Terjadi kesalahan saat memproses tombol.",
            ephemeral: true,
          });
        } catch (replyError) {
          console.error("Button Error Reply Failed:", replyError);
        }
      }
    }

    return;
  }

  /*
    |--------------------------------------------------------------------------
    | Modals
    |--------------------------------------------------------------------------
    */

  if (interaction.isModalSubmit()) {
    try {
      switch (interaction.customId) {
        case "tzockey_redeem_modal":
          await redeemKey.handleModal(interaction);
          break;

        case "tzockey_reset_hwid_modal":
          await resetHwid.handleModal(interaction);
          break;
      }
    } catch (error) {
      console.error("Modal Interaction Error:", error);

      if (!interaction.replied && !interaction.deferred) {
        try {
          await interaction.reply({
            content: "Terjadi kesalahan saat memproses form.",
            ephemeral: true,
          });
        } catch (replyError) {
          console.error("Modal Error Reply Failed:", replyError);
        }
      }
    }

    return;
  }

  /*
    |--------------------------------------------------------------------------
    | Slash Commands
    |--------------------------------------------------------------------------
    */

  if (!interaction.isChatInputCommand()) {
    return;
  }

  try {
    switch (interaction.commandName) {
      case "generate-key":
        await generateKey.execute(interaction);
        break;

      case "extend-key":
        await extendKey.execute(interaction);
        break;

      case "redeem-key":
        await redeemKey.execute(interaction);
        break;

      case "delete-key":
        await deleteKey.execute(interaction);
        break;

      case "my-keys":
        await myKeys.execute(interaction);
        break;

      case "reset-hwid":
        await resetHwid.execute(interaction);
        break;

      case "admin-reset-hwid":
        await adminResetHwid.execute(interaction);
        break;

      case "add-product":
        await addProduct.execute(interaction);
        break;

      case "list-products":
        await listProducts.execute(interaction);
        break;

      case "edit-product":
        await editProduct.execute(interaction);
        break;

      case "disable-product":
        await disableProduct.execute(interaction);
        break;

      case "enable-product":
        await enableProduct.execute(interaction);
        break;

      case "delete-product":
        await deleteProduct.execute(interaction);
        break;

      case "disable-key":
        await disableKey.execute(interaction);
        break;

      case "enable-key":
        await enableKey.execute(interaction);
        break;

      case "key-info":
        await keyInfo.execute(interaction);
        break;

      case "list-keys":
        await listKeys.execute(interaction);
        break;

      case "panel":
        await panel.execute(interaction);
        break;

      case "set-ticket-category":
        await setTicketCategory.execute(interaction);
        break;

      case "set-renewal-category":
        await setRenewalCategory.execute(interaction);
        break;

      case "set-loader-url":
        await setLoaderUrl.execute(interaction);
        break;

      case "get-loader":
        await getLoader.execute(interaction);
        break;

      case "loader-info":
        await loaderInfo.execute(interaction);
        break;
    }
  } catch (error) {
    console.error(`Command Error [${interaction.commandName}]:`, error);

    try {
      if (interaction.deferred) {
        await interaction.editReply({
          content: "Terjadi kesalahan saat memproses command.",
        });
      } else if (interaction.replied) {
        await interaction.followUp({
          content: "Terjadi kesalahan saat memproses command.",
          ephemeral: true,
        });
      } else {
        await interaction.reply({
          content: "Terjadi kesalahan saat memproses command.",
          ephemeral: true,
        });
      }
    } catch (replyError) {
      console.error("Command Error Reply Failed:", replyError);
    }
  }
});

/*
|--------------------------------------------------------------------------
| Login
|--------------------------------------------------------------------------
*/

client.login(DISCORD_TOKEN);
