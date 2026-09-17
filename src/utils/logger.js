const fs = require("fs");
const path = require("path");

const LOG_DIR = path.join(__dirname, "../../logs");

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function getLogFile() {
  const date = new Date().toISOString().slice(0, 10);

  return path.join(LOG_DIR, `${date}.log`);
}

function writeLog(level, message) {
  const timestamp = new Date().toISOString();

  const line = `[${timestamp}] [${level}] ${message}\n`;

  fs.appendFileSync(getLogFile(), line, "utf8");

  console.log(line.trim());
}

function info(message) {
  writeLog("INFO", message);
}

function warn(message) {
  writeLog("WARN", message);
}

function error(message) {
  writeLog("ERROR", message);
}

module.exports = {
  info,
  warn,
  error,
};
