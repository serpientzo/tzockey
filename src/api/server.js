require("dotenv").config();

const express = require("express");
const db = require("../database/database");
const { generateSessionToken } = require("../utils/sessionToken");
const logger = require("../utils/logger");
const { createBackup } = require("../database/backup");

const app = express();

const PORT = Number(process.env.PORT) || 3000;

const SESSION_DURATION_MINUTES =
  Number(process.env.SESSION_DURATION_MINUTES) || 5;

const SESSION_DURATION = SESSION_DURATION_MINUTES * 60 * 1000;

if (!Number.isFinite(PORT) || PORT <= 0) {
  throw new Error("PORT tidak valid.");
}

if (
  !Number.isFinite(SESSION_DURATION_MINUTES) ||
  SESSION_DURATION_MINUTES <= 0
) {
  throw new Error("SESSION_DURATION_MINUTES tidak valid.");
}

app.disable("x-powered-by");

app.use(
  express.json({
    limit: "10kb",
  }),
);

/*
|--------------------------------------------------------------------------
| Rate Limit
|--------------------------------------------------------------------------
*/

const rateLimits = new Map();

const RATE_LIMITS = {
  keyVerify: {
    max: 10,
    window: 60 * 1000,
  },

  sessionVerify: {
    max: 30,
    window: 60 * 1000,
  },

  scriptLoad: {
    max: 10,
    window: 60 * 1000,
  },
};

function checkRateLimit(type, ip) {
  const config = RATE_LIMITS[type];

  if (!config) {
    return true;
  }

  const now = Date.now();
  const key = `${type}:${ip}`;

  let record = rateLimits.get(key);

  if (!record || now - record.start >= config.window) {
    record = {
      start: now,
      count: 0,
    };
  }

  record.count++;

  rateLimits.set(key, record);

  return record.count <= config.max;
}

setInterval(
  () => {
    const now = Date.now();

    for (const [key, record] of rateLimits.entries()) {
      if (now - record.start >= 5 * 60 * 1000) {
        rateLimits.delete(key);
      }
    }
  },
  5 * 60 * 1000,
);

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function isValidString(value, maxLength) {
  return (
    typeof value === "string" && value.length > 0 && value.length <= maxLength
  );
}

function createSession(keyData, hwid) {
  const sessionToken = generateSessionToken();

  const createdAt = Date.now();
  const expiresAt = createdAt + SESSION_DURATION;

  db.prepare(
    `
        INSERT INTO sessions (
            session_token,
            key_id,
            discord_id,
            hwid,
            created_at,
            expires_at
        )
        VALUES (?, ?, ?, ?, ?, ?)
    `,
  ).run(
    sessionToken,
    keyData.id,
    keyData.discord_id,
    hwid,
    createdAt,
    expiresAt,
  );

  logger.info(`Session created: key_id=${keyData.id}`);

  return {
    sessionToken,
    createdAt,
    expiresAt,
  };
}

/*
|--------------------------------------------------------------------------
| Health Check
|--------------------------------------------------------------------------
*/

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Tzockey API is running.",
  });
});

/*
|--------------------------------------------------------------------------
| POST /api/key/verify
|--------------------------------------------------------------------------
*/

app.post("/api/key/verify", (req, res) => {
  const ip = req.ip;

  if (!checkRateLimit("keyVerify", ip)) {
    logger.warn(`Rate limit exceeded: /api/key/verify ip=${ip}`);

    return res.status(429).json({
      success: false,
      code: "RATE_LIMITED",
      message: "Too many requests.",
    });
  }

  const { key, hwid } = req.body;

  if (!isValidString(key, 64)) {
    return res.status(400).json({
      success: false,
      code: "INVALID_KEY",
      message: "Invalid key.",
    });
  }

  if (!isValidString(hwid, 128)) {
    return res.status(400).json({
      success: false,
      code: "INVALID_HWID",
      message: "Invalid HWID.",
    });
  }

  const normalizedKey = key.trim().toUpperCase();

  const keyData = db
    .prepare(
      `
        SELECT
            keys.*,
            products.name AS product_name,
            products.status AS product_status
        FROM keys
        JOIN products
            ON products.id = keys.product_id
        WHERE keys.key = ?
    `,
    )
    .get(normalizedKey);

  if (!keyData) {
    logger.warn(`Invalid key verification attempt`);

    return res.status(404).json({
      success: false,
      code: "KEY_NOT_FOUND",
      message: "Key tidak ditemukan.",
    });
  }

  /*
    |--------------------------------------------------------------------------
    | Product validation
    |--------------------------------------------------------------------------
    */

  if (keyData.product_status !== "Active") {
    logger.warn(`Inactive product access: key_id=${keyData.id}`);

    return res.status(403).json({
      success: false,
      code: "PRODUCT_INACTIVE",
      message: "Product sedang tidak aktif.",
    });
  }

  /*
    |--------------------------------------------------------------------------
    | Key status
    |--------------------------------------------------------------------------
    */

  if (keyData.status !== "Active") {
    return res.status(403).json({
      success: false,
      code: "KEY_INACTIVE",
      message: `Key tidak dapat digunakan. Status: ${keyData.status}`,
    });
  }

  /*
    |--------------------------------------------------------------------------
    | Expiration
    |--------------------------------------------------------------------------
    */

  if (keyData.expires_at && Date.now() >= keyData.expires_at) {
    db.prepare(
      `
            UPDATE keys
            SET status = 'Expired'
            WHERE id = ?
        `,
    ).run(keyData.id);

    logger.warn(`Expired key attempted: key_id=${keyData.id}`);

    return res.status(403).json({
      success: false,
      code: "KEY_EXPIRED",
      message: "Key sudah expired.",
    });
  }

  /*
    |--------------------------------------------------------------------------
    | HWID
    |--------------------------------------------------------------------------
    */

  if (!keyData.hwid) {
    db.prepare(
      `
            UPDATE keys
            SET hwid = ?
            WHERE id = ?
        `,
    ).run(hwid, keyData.id);

    logger.info(`HWID registered: key_id=${keyData.id}`);
  } else if (keyData.hwid !== hwid) {
    logger.warn(`HWID mismatch: key_id=${keyData.id}`);

    return res.status(403).json({
      success: false,
      code: "HWID_MISMATCH",
      message: "HWID tidak cocok.",
    });
  }

  /*
    |--------------------------------------------------------------------------
    | Delete previous sessions
    |--------------------------------------------------------------------------
    */

  db.prepare(
    `
        DELETE FROM sessions
        WHERE key_id = ?
    `,
  ).run(keyData.id);

  /*
    |--------------------------------------------------------------------------
    | Create new session
    |--------------------------------------------------------------------------
    */

  const session = createSession(keyData, hwid);

  logger.info(`Key verified: key_id=${keyData.id}`);

  return res.json({
    success: true,
    code: "KEY_VERIFIED",
    message: "Key berhasil diverifikasi.",
    data: {
      session_token: session.sessionToken,
      product: keyData.product_name,
      expires_at: keyData.expires_at,
      session_expires_at: session.expiresAt,
      remaining_seconds: Math.max(
        0,
        Math.floor((keyData.expires_at - Date.now()) / 1000),
      ),
    },
  });
});

/*
|--------------------------------------------------------------------------
| POST /api/session/verify
|--------------------------------------------------------------------------
*/

app.post("/api/session/verify", (req, res) => {
  const ip = req.ip;

  if (!checkRateLimit("sessionVerify", ip)) {
    logger.warn(`Rate limit exceeded: /api/session/verify ip=${ip}`);

    return res.status(429).json({
      success: false,
      code: "RATE_LIMITED",
      message: "Too many requests.",
    });
  }

  const { session_token, hwid } = req.body;

  if (!isValidString(session_token, 128)) {
    return res.status(400).json({
      success: false,
      code: "INVALID_SESSION",
      message: "Invalid session token.",
    });
  }

  if (!isValidString(hwid, 128)) {
    return res.status(400).json({
      success: false,
      code: "INVALID_HWID",
      message: "Invalid HWID.",
    });
  }

  const session = db
    .prepare(
      `
        SELECT
            sessions.*,
            keys.status AS key_status,
            keys.expires_at AS key_expires_at,
            keys.product_id,
            products.name AS product_name,
            products.status AS product_status
        FROM sessions
        JOIN keys
            ON keys.id = sessions.key_id
        JOIN products
            ON products.id = keys.product_id
        WHERE sessions.session_token = ?
    `,
    )
    .get(session_token);

  if (!session) {
    return res.status(401).json({
      success: false,
      code: "INVALID_SESSION",
      message: "Session tidak valid.",
    });
  }

  /*
    |--------------------------------------------------------------------------
    | Session expiration
    |--------------------------------------------------------------------------
    */

  if (Date.now() >= session.expires_at) {
    db.prepare(
      `
            DELETE FROM sessions
            WHERE id = ?
        `,
    ).run(session.id);

    logger.info(`Session expired: key_id=${session.key_id}`);

    return res.status(401).json({
      success: false,
      code: "SESSION_EXPIRED",
      message: "Session sudah expired.",
    });
  }

  /*
    |--------------------------------------------------------------------------
    | HWID
    |--------------------------------------------------------------------------
    */

  if (session.hwid !== hwid) {
    logger.warn(`Session HWID mismatch: key_id=${session.key_id}`);

    return res.status(403).json({
      success: false,
      code: "HWID_MISMATCH",
      message: "HWID tidak cocok.",
    });
  }

  /*
    |--------------------------------------------------------------------------
    | Key status
    |--------------------------------------------------------------------------
    */

  if (session.key_status !== "Active") {
    return res.status(403).json({
      success: false,
      code: "KEY_INACTIVE",
      message: "Key tidak aktif.",
    });
  }

  /*
    |--------------------------------------------------------------------------
    | Key expiration
    |--------------------------------------------------------------------------
    */

  if (session.key_expires_at && Date.now() >= session.key_expires_at) {
    db.prepare(
      `
            UPDATE keys
            SET status = 'Expired'
            WHERE id = ?
        `,
    ).run(session.key_id);

    db.prepare(
      `
            DELETE FROM sessions
            WHERE id = ?
        `,
    ).run(session.id);

    logger.warn(`Expired key session: key_id=${session.key_id}`);

    return res.status(403).json({
      success: false,
      code: "KEY_EXPIRED",
      message: "Key sudah expired.",
    });
  }

  /*
    |--------------------------------------------------------------------------
    | Product status
    |--------------------------------------------------------------------------
    */

  if (session.product_status !== "Active") {
    return res.status(403).json({
      success: false,
      code: "PRODUCT_INACTIVE",
      message: "Product sedang tidak aktif.",
    });
  }

  const remainingSeconds = Math.max(
    0,
    Math.floor((session.key_expires_at - Date.now()) / 1000),
  );

  return res.json({
    success: true,
    code: "SESSION_VALID",
    message: "Session masih valid.",
    data: {
      product: session.product_name,
      expires_at: session.key_expires_at,
      session_expires_at: session.expires_at,
      remaining_seconds: remainingSeconds,
    },
  });
});

/*
|--------------------------------------------------------------------------
| POST /api/script/load
|--------------------------------------------------------------------------
*/

app.post("/api/script/load", async (req, res) => {
  const ip = req.ip;

  if (!checkRateLimit("scriptLoad", ip)) {
    logger.warn(`Rate limit exceeded: /api/script/load ip=${ip}`);

    return res.status(429).json({
      success: false,
      code: "RATE_LIMITED",
      message: "Too many requests.",
    });
  }

  const { session_token, hwid } = req.body;

  if (!isValidString(session_token, 128)) {
    return res.status(400).json({
      success: false,
      code: "INVALID_SESSION",
      message: "Invalid session token.",
    });
  }

  if (!isValidString(hwid, 128)) {
    return res.status(400).json({
      success: false,
      code: "INVALID_HWID",
      message: "Invalid HWID.",
    });
  }

  const session = db
    .prepare(
      `
        SELECT
            sessions.*,
            keys.status AS key_status,
            keys.expires_at AS key_expires_at,
            keys.product_id,
            products.name AS product_name,
            products.status AS product_status,
            products.script_url
        FROM sessions
        JOIN keys
            ON keys.id = sessions.key_id
        JOIN products
            ON products.id = keys.product_id
        WHERE sessions.session_token = ?
    `,
    )
    .get(session_token);

  if (!session) {
    return res.status(401).json({
      success: false,
      code: "INVALID_SESSION",
      message: "Session tidak valid.",
    });
  }

  /*
    |--------------------------------------------------------------------------
    | Session expiration
    |--------------------------------------------------------------------------
    */

  if (Date.now() >= session.expires_at) {
    db.prepare(
      `
            DELETE FROM sessions
            WHERE id = ?
        `,
    ).run(session.id);

    return res.status(401).json({
      success: false,
      code: "SESSION_EXPIRED",
      message: "Session sudah expired.",
    });
  }

  /*
    |--------------------------------------------------------------------------
    | HWID
    |--------------------------------------------------------------------------
    */

  if (session.hwid !== hwid) {
    logger.warn(`Script HWID mismatch: key_id=${session.key_id}`);

    return res.status(403).json({
      success: false,
      code: "HWID_MISMATCH",
      message: "HWID tidak cocok.",
    });
  }

  /*
    |--------------------------------------------------------------------------
    | Key status
    |--------------------------------------------------------------------------
    */

  if (session.key_status !== "Active") {
    return res.status(403).json({
      success: false,
      code: "KEY_INACTIVE",
      message: "Key tidak aktif.",
    });
  }

  /*
    |--------------------------------------------------------------------------
    | Key expiration
    |--------------------------------------------------------------------------
    */

  if (session.key_expires_at && Date.now() >= session.key_expires_at) {
    db.prepare(
      `
            UPDATE keys
            SET status = 'Expired'
            WHERE id = ?
        `,
    ).run(session.key_id);

    db.prepare(
      `
            DELETE FROM sessions
            WHERE id = ?
        `,
    ).run(session.id);

    return res.status(403).json({
      success: false,
      code: "KEY_EXPIRED",
      message: "Key sudah expired.",
    });
  }

  /*
    |--------------------------------------------------------------------------
    | Product status
    |--------------------------------------------------------------------------
    */

  if (session.product_status !== "Active") {
    return res.status(403).json({
      success: false,
      code: "PRODUCT_INACTIVE",
      message: "Product sedang tidak aktif.",
    });
  }

  /*
    |--------------------------------------------------------------------------
    | Script URL
    |--------------------------------------------------------------------------
    */

  if (!isValidString(session.script_url, 2048)) {
    logger.error(`Invalid script URL: product_id=${session.product_id}`);

    return res.status(500).json({
      success: false,
      code: "INVALID_SCRIPT_URL",
      message: "Script URL tidak valid.",
    });
  }

  let scriptUrl;

  try {
    scriptUrl = new URL(session.script_url);
  } catch {
    logger.error(`Malformed script URL: product_id=${session.product_id}`);

    return res.status(500).json({
      success: false,
      code: "INVALID_SCRIPT_URL",
      message: "Script URL tidak valid.",
    });
  }

  if (scriptUrl.protocol !== "https:" && scriptUrl.protocol !== "http:") {
    logger.error(
      `Unsupported script protocol: product_id=${session.product_id}`,
    );

    return res.status(500).json({
      success: false,
      code: "INVALID_SCRIPT_URL",
      message: "Protocol script URL tidak didukung.",
    });
  }

  /*
    |--------------------------------------------------------------------------
    | Fetch script
    |--------------------------------------------------------------------------
    */

  let response;

  try {
    response = await fetch(scriptUrl.toString(), {
      method: "GET",
      redirect: "error",
      signal: AbortSignal.timeout(10000),
    });
  } catch (error) {
    logger.error(
      `Script fetch failed: product_id=${session.product_id} error=${error.message}`,
    );

    return res.status(502).json({
      success: false,
      code: "SCRIPT_FETCH_FAILED",
      message: "Gagal mengambil script.",
    });
  }

  if (!response.ok) {
    logger.error(
      `Script fetch returned ${response.status}: product_id=${session.product_id}`,
    );

    return res.status(502).json({
      success: false,
      code: "SCRIPT_FETCH_FAILED",
      message: "Script tidak dapat diambil.",
    });
  }

  let script;

  try {
    script = await response.text();
  } catch (error) {
    logger.error(
      `Script read failed: product_id=${session.product_id} error=${error.message}`,
    );

    return res.status(502).json({
      success: false,
      code: "SCRIPT_READ_FAILED",
      message: "Gagal membaca script.",
    });
  }

  if (!script || script.length === 0) {
    logger.error(`Empty script: product_id=${session.product_id}`);

    return res.status(502).json({
      success: false,
      code: "EMPTY_SCRIPT",
      message: "Script kosong.",
    });
  }

  logger.info(
    `Script loaded: key_id=${session.key_id} product_id=${session.product_id}`,
  );

  return res.json({
    success: true,
    code: "SCRIPT_LOADED",
    message: "Script berhasil dimuat.",
    data: {
      product: session.product_name,
      script,
    },
  });
});

/*
|--------------------------------------------------------------------------
| Cleanup expired sessions
|--------------------------------------------------------------------------
*/

setInterval(
  () => {
    const result = db
      .prepare(
        `
        DELETE FROM sessions
        WHERE expires_at <= ?
    `,
      )
      .run(Date.now());

    if (result.changes > 0) {
      logger.info(`Expired sessions cleaned: ${result.changes}`);
    }
  },
  10 * 60 * 1000,
);

/*
|--------------------------------------------------------------------------
| Global Error Handler
|--------------------------------------------------------------------------
*/

app.use((error, req, res, next) => {
  logger.error(`${req.method} ${req.path} - ${error.message}`);

  res.status(500).json({
    success: false,
    code: "INTERNAL_SERVER_ERROR",
    message: "Internal server error.",
  });
});

/*
|--------------------------------------------------------------------------
| Start Server
|--------------------------------------------------------------------------
*/

app.listen(PORT, "0.0.0.0", async () => {
  logger.info(`Tzockey API berjalan di port ${PORT}`);

  await createBackup();

  setInterval(
    () => {
      createBackup();
    },
    6 * 60 * 60 * 1000,
  );
});
