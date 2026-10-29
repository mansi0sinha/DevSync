const mongoose = require("mongoose");

const MAX_CONNECT_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [1000, 2500];
const NETWORK_ERROR_CODES = new Set([
  "ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "EHOSTUNREACH", "ENETUNREACH",
  "ENOTFOUND", "EAI_AGAIN", "ESERVFAIL", "91", "11600", "11602",
]);

function findErrorCode(error) {
  const pending = [error];
  const seen = new Set();
  while (pending.length) {
    const current = pending.shift();
    if (!current || typeof current !== "object" || seen.has(current)) continue;
    seen.add(current);
    if (current.code) return current.code;
    for (const nested of [current.cause, current.originalError, current.reason?.cause]) {
      if (nested && typeof nested === "object") pending.push(nested);
    }
    const servers = current.reason?.servers;
    if (servers && typeof servers.values === "function") {
      for (const server of servers.values()) {
        if (server?.error && typeof server.error === "object") pending.push(server.error);
      }
    }
  }
  return "";
}

function diagnoseMongoError(error) {
  const code = String(findErrorCode(error));
  const safeMessage = String(error?.message || "");
  if (["18", "AuthenticationFailed", "SCRAM_AUTHENTICATION_FAILED"].includes(code) || /authentication failed|bad auth/i.test(safeMessage)) {
    return "MongoDB authentication failed. Check the configured database username, password, and authentication database.";
  }
  if (["91", "11600", "11602"].includes(code)) {
    return "MongoDB temporarily interrupted the operation while a node restarted or changed primary. Retry after the cluster is available.";
  }
  if (["ENOTFOUND", "EAI_AGAIN", "ESERVFAIL"].includes(code)) {
    return "MongoDB DNS lookup failed. Check the configured hostname and DNS/network access.";
  }
  if (/TLS|SSL|certificate/i.test(code) || /TLS|SSL|certificate/i.test(safeMessage)) {
    return "MongoDB TLS negotiation failed. Check the runtime's TLS support and network inspection settings.";
  }
  if (["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "EHOSTUNREACH", "ENETUNREACH"].includes(code)) {
    return `MongoDB network connection failed (${code}). Check outbound network access, firewall rules, and the Atlas IP access list.`;
  }
  if (["MongoNetworkError", "MongoNetworkTimeoutError"].includes(error?.name) || /connection reset|network timeout/i.test(safeMessage)) {
    return "MongoDB network connection was interrupted. Check outbound network access, firewall rules, and the Atlas IP access list.";
  }
  if (/buffering timed out/i.test(safeMessage)) {
    return "MongoDB was temporarily unavailable while the request was waiting for the connection to recover. Retry after the database reconnects.";
  }
  if (error?.name === "MongoServerSelectionError" || /server selection timed out|ReplicaSetNoPrimary|querySrv|topology was destroyed|connection pool was cleared/i.test(safeMessage)) {
    return "MongoDB cluster is unavailable or cannot be reached. Check cluster status, DNS, and network access.";
  }
  if (!process.env.MONGODB_URI) return "MongoDB is not configured. Set MONGODB_URI in the server environment.";
  return "MongoDB connection failed for an unclassified reason. Check the server environment and MongoDB service diagnostics.";
}

function isDatabaseUnavailableError(error) {
  const code = String(findErrorCode(error));
  if (NETWORK_ERROR_CODES.has(code)) return true;
  if (["MongoServerSelectionError", "MongoNetworkError", "MongoNetworkTimeoutError"].includes(error?.name)) return true;
  const message = String(error?.message || "");
  return /buffering timed out|server selection timed out|topology was destroyed|connection pool was cleared|connection reset|connection refused|network timeout/i.test(message);
}

function sleep(duration) {
  return new Promise((resolve) => setTimeout(resolve, duration));
}

let listenersAttached = false;
let connectionEstablished = false;
function attachConnectionDiagnostics() {
  if (listenersAttached) return;
  listenersAttached = true;
  mongoose.connection.on("error", (error) => {
    console.error(`MongoDB connection error: ${diagnoseMongoError(error)}`);
  });
  mongoose.connection.on("disconnected", () => {
    if (connectionEstablished) {
      connectionEstablished = false;
      console.error("MongoDB disconnected. API readiness checks will remain unavailable until the database reconnects.");
    }
  });
  mongoose.connection.on("reconnected", () => {
    connectionEstablished = true;
    console.info("MongoDB connection restored.");
  });
}

async function connectDB({ attempts = MAX_CONNECT_ATTEMPTS, retryDelays = RETRY_DELAYS_MS } = {}) {
  attachConnectionDiagnostics();
  if (!process.env.MONGODB_URI) throw new Error("MongoDB is not configured. Set MONGODB_URI in the server environment.");

  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 8000,
        connectTimeoutMS: 8000,
      });
      connectionEstablished = true;
      console.info("MongoDB connected successfully.");
      return mongoose.connection;
    } catch (error) {
      lastError = error;
      const diagnostic = diagnoseMongoError(error);
      console.error(`MongoDB connection attempt ${attempt}/${attempts} failed: ${diagnostic}`);
      if (attempt < attempts) {
        await mongoose.disconnect().catch(() => {});
        await sleep(retryDelays[attempt - 1] ?? retryDelays.at(-1) ?? 1000);
      }
    }
  }

  const failure = new Error(diagnoseMongoError(lastError));
  failure.code = "MONGODB_STARTUP_FAILED";
  throw failure;
}

module.exports = { connectDB, diagnoseMongoError, isDatabaseUnavailableError, MAX_CONNECT_ATTEMPTS, RETRY_DELAYS_MS };
