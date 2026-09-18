require("dotenv").config();

const isProduction = process.env.NODE_ENV === "production";

const DISCORD_TOKEN = isProduction
  ? process.env.PROD_DISCORD_TOKEN
  : process.env.DEV_DISCORD_TOKEN;

const CLIENT_ID = isProduction
  ? process.env.PROD_CLIENT_ID
  : process.env.DEV_CLIENT_ID;

const GUILD_ID = isProduction
  ? process.env.PROD_GUILD_ID
  : process.env.DEV_GUILD_ID;

module.exports = {
  isProduction,
  DISCORD_TOKEN,
  CLIENT_ID,
  GUILD_ID,
};
