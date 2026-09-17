const Database = require("better-sqlite3");

const db = new Database("src/database/tzockey.db");

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
    CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        script_url TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'Active',
        created_at INTEGER NOT NULL
    )
`);

db.exec(`
    CREATE TABLE IF NOT EXISTS keys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE NOT NULL,
        product_id INTEGER NOT NULL,
        plan TEXT NOT NULL,
        duration_seconds INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        expires_at INTEGER,
        discord_id TEXT,
        hwid TEXT,
        status TEXT NOT NULL DEFAULT 'Unused',
        reset_count INTEGER NOT NULL DEFAULT 0,

        FOREIGN KEY (product_id)
            REFERENCES products(id)
    )
`);

db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_token TEXT UNIQUE NOT NULL,
        key_id INTEGER NOT NULL,
        discord_id TEXT,
        hwid TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,

        FOREIGN KEY (key_id)
            REFERENCES keys(id)
            ON DELETE CASCADE
    )
`);

db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
    )
`);

console.log("Database Tzockey berhasil terhubung.");

module.exports = db;
