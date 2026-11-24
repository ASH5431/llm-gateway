import { createHash } from "node:crypto";
import { recordRequest } from "../utils/telemetry.js"; // <-- NEW

const responseCache = new Map();
const CACHE_TTL_MS = 60 * 1000;

function makeCacheKey(prompt) {
  const normalized = prompt.trim().toLowerCase();
  return createHash("sha256").update(normalized).digest("hex");
}

export function checkCache(req, res, next) {
  if (!req.body || typeof req.body.prompt !== "string") {
    return next();
  }

  const startTime = Date.now();
  const key = makeCacheKey(req.body.prompt);
  const cachedEntry = responseCache.get(key);

  if (cachedEntry) {
    if (Date.now() < cachedEntry.expiresAt) {
      const latencyMs = Date.now() - startTime;
      const savedTokens = cachedEntry.originalTokens || 0;

      console.log(`[Cache] HIT! Returned in ${latencyMs}ms (Saved ${savedTokens} tokens).`);

      // <-- NEW: Log this Cache Hit to our analytics telemetry
      recordRequest({
        timestamp: new Date().toISOString(),
        model: cachedEntry.model,
        cached: true,
        piiRedacted: req.piiRedactedCount || 0,
        latencyMs,
        tokensTotal: 0,
        tokensSaved: savedTokens,
      });

      return res.json({
        gateway: {
          model: cachedEntry.model,
          cached: true,
          piiRedacted: req.piiRedactedCount || 0,
          latencyMs,
          tokens: { input: 0, output: 0, total: 0 },
          tokensSaved: savedTokens,
        },
        reply: cachedEntry.reply,
      });
    }

    responseCache.delete(key);
  }

  console.log("[Cache] MISS. Forwarding to AI provider...");
  req.cacheKey = key;
  next();
}

// <-- UPDATED: Now stores originalTokens so future Cache Hits know how much they saved
export function saveToCache(key, model, reply, originalTokens = 0) {
  if (!key || !reply) return;

  responseCache.set(key, {
    model,
    reply,
    originalTokens,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}