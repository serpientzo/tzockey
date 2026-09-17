const fs = require("fs");
const path = require("path");

const BACKUP_DIR = process.env.DB_BACKUP_DIR || path.join(__dirname, "backups");

const DATABASE_PATH = process.env.DB_PATH || path.join(__dirname, "tzockey.db");

const backupName = process.argv[2];

if (!backupName) {
  console.error("Gunakan: node src/database/restore.js <nama-backup>");
  process.exit(1);
}

const backupPath = path.join(BACKUP_DIR, backupName);

if (!fs.existsSync(backupPath)) {
  console.error(`Backup tidak ditemukan: ${backupName}`);
  process.exit(1);
}

if (!backupName.endsWith(".db")) {
  console.error("File backup tidak valid.");
  process.exit(1);
}

if (fs.existsSync(DATABASE_PATH)) {
  const currentBackupPath = path.join(
    BACKUP_DIR,
    `before-restore-${Date.now()}.db`,
  );

  fs.copyFileSync(DATABASE_PATH, currentBackupPath);

  console.log(`Database saat ini dicadangkan ke: ${currentBackupPath}`);
}

fs.copyFileSync(backupPath, DATABASE_PATH);

console.log(`Database berhasil di-restore dari: ${backupName}`);
