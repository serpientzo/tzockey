require("dotenv").config();

const express = require("express");
const dns = require("dns").promises;
const net = require("net");

const db = require("../database/database");
const { generateSessionToken } = require("../utils/sessionToken");
const logger = require("../utils/logger");
const { createBackup } = require("../database/backup");

const app = express();

const PORT = Number(process.env.PORT) || 3000;

const SESSION_DURATION_MINUTES =
  Number(process.env.SESSION_DURATION_MINUTES) || 5;

const SESSION_DURATION = SESSION_DURATION_MINUTES * 60 * 1000;

const MAX_SCRIPT_SIZE = 1024 * 1024;

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

function isPrivateIPv4(ip) {
  const parts = ip.split(".").map(Number);

  if (parts.length !== 4) {
    return false;
  }

  if (parts.some((part) => !Number.isInteger(part))) {
    return false;
  }

  const [a, b] = parts;

  if (a === 10) {
    return true;
  }

  if (a === 127) {
    return true;
  }

  if (a === 169 && b === 254) {
    return true;
  }

  if (a === 172 && b >= 16 && b <= 31) {
    return true;
  }

  if (a === 192 && b === 168) {
    return true;
  }

  if (a === 0) {
    return true;
  }

  return false;
}

function isPrivateIPv6(ip) {
  const normalized = ip.toLowerCase();

  if (normalized === "::1") {
    return true;
  }

  if (normalized === "::") {
    return true;
  }

  if (normalized.startsWith("fc") || normalized.startsWith("fd")) {
    return true;
  }

  if (
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb")
  ) {
    return true;
  }

  return false;
}

function isBlockedHostname(hostname) {
  const normalized = hostname.toLowerCase().replace(/\.$/, "");

  if (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized.endsWith(".local")
  ) {
    return true;
  }

  return false;
}

async function isSafeScriptUrl(url) {
  if (url.protocol !== "https:") {
    return false;
  }

  if (url.username || url.password) {
    return false;
  }

  const hostname = url.hostname;

  if (!hostname) {
    return false;
  }

  if (isBlockedHostname(hostname)) {
    return false;
  }

  const ipType = net.isIP(hostname);

  if (ipType === 4) {
    return !isPrivateIPv4(hostname);
  }

  if (ipType === 6) {
    return !isPrivateIPv6(hostname);
  }

  try {
    const addresses = await dns.lookup(hostname, {
      all: true,
      verbatim: true,
    });

    if (!addresses || addresses.length === 0) {
      return false;
    }

    for (const address of addresses) {
      if (address.family === 4) {
        if (isPrivateIPv4(address.address)) {
          return false;
        }
      }

      if (address.family === 6) {
        if (isPrivateIPv6(address.address)) {
          return false;
        }
      }
    }

    return true;
  } catch (error) {
    logger.error(`DNS lookup failed for script URL: ${error.message}`);

    return false;
  }
}

async function fetchScript(url) {
  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, 10000);

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      redirect: "error",
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        success: false,
        code: "SCRIPT_FETCH_FAILED",
        message: "Script tidak dapat diambil.",
      };
    }

    const contentLength = response.headers.get("content-length");

    if (
      contentLength &&
      Number.isFinite(Number(contentLength)) &&
      Number(contentLength) > MAX_SCRIPT_SIZE
    ) {
      return {
        success: false,
        code: "SCRIPT_TOO_LARGE",
        message: "Ukuran script terlalu besar.",
      };
    }

    if (!response.body) {
      return {
        success: false,
        code: "SCRIPT_READ_FAILED",
        message: "Gagal membaca script.",
      };
    }

    const reader = response.body.getReader();

    const chunks = [];
    let totalSize = 0;

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      totalSize += value.byteLength;

      if (totalSize > MAX_SCRIPT_SIZE) {
        await reader.cancel();

        return {
          success: false,
          code: "SCRIPT_TOO_LARGE",
          message: "Ukuran script terlalu besar.",
        };
      }

      chunks.push(Buffer.from(value));
    }

    const script = Buffer.concat(chunks).toString("utf8");

    if (!script || script.length === 0) {
      return {
        success: false,
        code: "EMPTY_SCRIPT",
        message: "Script kosong.",
      };
    }

    return {
      success: true,
      script,
    };
  } catch (error) {
    logger.error(`Script fetch failed: ${error.message}`);

    return {
      success: false,
      code: "SCRIPT_FETCH_FAILED",
      message: "Gagal mengambil script.",
    };
  } finally {
    clearTimeout(timeout);
  }
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
    logger.warn("Invalid key verification attempt");

    return res.status(404).json({
      success: false,
      code: "KEY_NOT_FOUND",
      message: "Key tidak ditemukan.",
    });
  }

  if (keyData.product_status !== "Active") {
    logger.warn(`Inactive product access: key_id=${keyData.id}`);

    return res.status(403).json({
      success: false,
      code: "PRODUCT_INACTIVE",
      message: "Product sedang tidak aktif.",
    });
  }

  if (keyData.status !== "Active") {
    return res.status(403).json({
      success: false,
      code: "KEY_INACTIVE",
      message: `Key tidak dapat digunakan. Status: ${keyData.status}`,
    });
  }

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
    | Atomic HWID registration
    |--------------------------------------------------------------------------
    */

  if (!keyData.hwid) {
    const result = db
      .prepare(
        `
            UPDATE keys
            SET hwid = ?
            WHERE id = ?
            AND hwid IS NULL
          `,
      )
      .run(hwid, keyData.id);

    if (result.changes === 0) {
      const latestKeyData = db
        .prepare(
          `
              SELECT hwid
              FROM keys
              WHERE id = ?
            `,
        )
        .get(keyData.id);

      if (!latestKeyData || latestKeyData.hwid !== hwid) {
        logger.warn(`HWID registration race/mismatch: key_id=${keyData.id}`);

        return res.status(403).json({
          success: false,
          code: "HWID_MISMATCH",
          message: "HWID tidak cocok.",
        });
      }
    } else {
      logger.info(`HWID registered: key_id=${keyData.id}`);
    }
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
    | Create session
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

  if (session.hwid !== hwid) {
    logger.warn(`Session HWID mismatch: key_id=${session.key_id}`);

    return res.status(403).json({
      success: false,
      code: "HWID_MISMATCH",
      message: "HWID tidak cocok.",
    });
  }

  if (session.key_status !== "Active") {
    return res.status(403).json({
      success: false,
      code: "KEY_INACTIVE",
      message: "Key tidak aktif.",
    });
  }

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

  if (session.hwid !== hwid) {
    logger.warn(`Script HWID mismatch: key_id=${session.key_id}`);

    return res.status(403).json({
      success: false,
      code: "HWID_MISMATCH",
      message: "HWID tidak cocok.",
    });
  }

  if (session.key_status !== "Active") {
    return res.status(403).json({
      success: false,
      code: "KEY_INACTIVE",
      message: "Key tidak aktif.",
    });
  }

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

  if (session.product_status !== "Active") {
    return res.status(403).json({
      success: false,
      code: "PRODUCT_INACTIVE",
      message: "Product sedang tidak aktif.",
    });
  }

  /*
    |--------------------------------------------------------------------------
    | Script URL validation
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

  if (!(await isSafeScriptUrl(scriptUrl))) {
    logger.error(`Blocked script URL: product_id=${session.product_id}`);

    return res.status(500).json({
      success: false,
      code: "INVALID_SCRIPT_URL",
      message: "Script URL tidak diizinkan.",
    });
  }

  /*
    |--------------------------------------------------------------------------
    | Fetch script
    |--------------------------------------------------------------------------
    */

  const result = await fetchScript(scriptUrl);

  if (!result.success) {
    logger.error(`${result.code}: product_id=${session.product_id}`);

    return res.status(502).json({
      success: false,
      code: result.code,
      message: result.message,
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
      script: result.script,
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

  if (res.headersSent) {
    return next(error);
  }

  return res.status(500).json({
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

  if (process.env.NODE_ENV === "production") {
    await createBackup();

    setInterval(
      () => {
        createBackup();
      },
      6 * 60 * 60 * 1000,
    );

    logger.info("Database backup otomatis aktif.");
  } else {
    logger.info("Database backup otomatis dinonaktifkan untuk development.");
  }
});
