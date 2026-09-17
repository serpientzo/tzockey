require("dotenv").config();

const { REST, Routes } = require("discord.js");

const { command: generateKeyCommand } = require("./generateKey");
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
const { command: editProduct } = require("./editProduct");
const { command: disableProduct } = require("./disableProduct");
const { command: enableProduct } = require("./enableProduct");
const { command: deleteProductCommand } = require("./deleteProduct");
const { command: panelCommand } = require("./panel");
const { command: setTicketCategoryCommand } = require("./setTicketCategory");

// Loader Management
const { command: setLoaderUrlCommand } = require("./setLoaderUrl");
const { command: getLoaderCommand } = require("./getLoader");
const { command: loaderInfoCommand } = require("./loaderInfo");

const commands = [
  generateKeyCommand.toJSON(),
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
  editProduct.toJSON(),
  disableProduct.toJSON(),
  enableProduct.toJSON(),
  deleteProductCommand.toJSON(),
  panelCommand.toJSON(),
  setTicketCategoryCommand.toJSON(),

  // Loader Management
  setLoaderUrlCommand.toJSON(),
  getLoaderCommand.toJSON(),
  loaderInfoCommand.toJSON(),
];

const rest = new REST({
  version: "10",
}).setToken(process.env.DISCORD_TOKEN);

async function registerCommands() {
  try {
    console.log("Mendaftarkan command Tzockey...");

    await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.GUILD_ID,
      ),
      {
        body: commands,
      },
    );

    console.log("Command berhasil didaftarkan.");
  } catch (error) {
    console.error(error);
  }
}

registerCommands();
