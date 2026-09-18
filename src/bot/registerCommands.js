require("dotenv").config();

const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = require("../config");

const { REST, Routes } = require("discord.js");

/*
|--------------------------------------------------------------------------
| Commands
|--------------------------------------------------------------------------
*/

const { command: generateKeyCommand } = require("./generateKey");

const { command: extendKeyCommand } = require("./extendKey");

const { command: redeemKeyCommand } = require("./redeemKey");

const { command: deleteKeyCommand } = require("./deleteKey");

const { command: myKeysCommand } = require("./myKeys");

const { command: resetHwidCommand } = require("./resetHwid");

const { command: adminResetHwidCommand } = require("./adminResetHwid");

const { command: addProductCommand } = require("./addProduct");

const { command: listProductsCommand } = require("./listProducts");

const { command: disableKeyCommand } = require("./disableKey");

const { command: enableKeyCommand } = require("./enableKey");

const { command: keyInfoCommand } = require("./keyInfo");

const { command: listKeysCommand } = require("./listKeys");

const { command: editProductCommand } = require("./editProduct");

const { command: disableProductCommand } = require("./disableProduct");

const { command: enableProductCommand } = require("./enableProduct");

const { command: deleteProductCommand } = require("./deleteProduct");

const { command: panelCommand } = require("./panel");

const { command: setTicketCategoryCommand } = require("./setTicketCategory");

const { command: setRenewalCategoryCommand } = require("./setRenewalCategory");

/*
|--------------------------------------------------------------------------
| Loader Management
|--------------------------------------------------------------------------
*/

const { command: setLoaderUrlCommand } = require("./setLoaderUrl");

const { command: getLoaderCommand } = require("./getLoader");

const { command: loaderInfoCommand } = require("./loaderInfo");

/*
|--------------------------------------------------------------------------
| Command List
|--------------------------------------------------------------------------
*/

const commands = [
  generateKeyCommand.toJSON(),
  extendKeyCommand.toJSON(),
  redeemKeyCommand.toJSON(),
  deleteKeyCommand.toJSON(),

  myKeysCommand.toJSON(),
  resetHwidCommand.toJSON(),
  adminResetHwidCommand.toJSON(),

  addProductCommand.toJSON(),
  listProductsCommand.toJSON(),

  disableKeyCommand.toJSON(),
  enableKeyCommand.toJSON(),
  keyInfoCommand.toJSON(),
  listKeysCommand.toJSON(),

  editProductCommand.toJSON(),
  disableProductCommand.toJSON(),
  enableProductCommand.toJSON(),
  deleteProductCommand.toJSON(),

  panelCommand.toJSON(),

  setTicketCategoryCommand.toJSON(),
  setRenewalCategoryCommand.toJSON(),

  // Loader Management
  setLoaderUrlCommand.toJSON(),
  getLoaderCommand.toJSON(),
  loaderInfoCommand.toJSON(),
];

/*
|--------------------------------------------------------------------------
| Discord REST
|--------------------------------------------------------------------------
*/

const rest = new REST({
  version: "10",
}).setToken(DISCORD_TOKEN);

/*
|--------------------------------------------------------------------------
| Register Commands
|--------------------------------------------------------------------------
*/

async function registerCommands() {
  try {
    console.log("Mendaftarkan command Tzockey...");

    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
      body: commands,
    });

    console.log("Command berhasil didaftarkan.");
  } catch (error) {
    console.error("Gagal mendaftarkan command Tzockey:", error);

    process.exitCode = 1;
  }
}

registerCommands();
