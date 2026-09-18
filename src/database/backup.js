const fs = require("fs");
const path = require("path");

const db = require("./database");
const logger = require("../utils/logger");

const BACKUP_DIR = process.env.DB_BACKUP_DIR || path.join(__dirname, "backups");

if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, {
    recursive: true,
  });
}

async function createBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

  const backupPath = path.join(BACKUP_DIR, `tzockey-${timestamp}.db`);

  try {
    await db.backup(backupPath);

    logger.info(`Database backup berhasil: ${path.basename(backupPath)}`);

    return backupPath;
  } catch (error) {
    logger.error(`Database backup gagal: ${error.message}`);

    return null;
  }
}

module.exports = {
  createBackup,
};
