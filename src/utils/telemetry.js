import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

// Keep the last 500 request logs in RAM for instant /v1/stats queries
const requestLogs = [];

// Ensure a 'logs' folder exists in your project root for persistent file logging
const logsDir = join(process.cwd(), "logs");
if (!existsSync(logsDir)) {
  mkdirSync(logsDir, { recursive: true });
}
const logFilePath = join(logsDir, "requests.jsonl");

// 1. Save one request event to RAM and append a JSON row to logs/requests.jsonl
export function recordRequest(entry) {
  requestLogs.push(entry);
  if (requestLogs.length > 500) {
    requestLogs.shift(); // Remove oldest item if RAM list exceeds 500
  }

  try {
    appendFileSync(logFilePath, JSON.stringify(entry) + "\n", "utf8");
  } catch (err) {
    console.error("[Telemetry] Failed to write log file:", err.message);
  }
}

// 2. Calculate aggregated analytics KPIs (just like SQL GROUP BY / SUM / AVG)
export function getStats() {
  const totalRequests = requestLogs.length;
  const cacheHits = requestLogs.filter((r) => r.cached).length;
  const cacheMisses = totalRequests - cacheHits;

  const cacheHitRate =
    totalRequests === 0
      ? "0.0%"
      : `${((cacheHits / totalRequests) * 100).toFixed(1)}%`;

  const totalTokensSpent = requestLogs.reduce((sum, r) => sum + r.tokensTotal, 0);
  const totalTokensSaved = requestLogs.reduce((sum, r) => sum + r.tokensSaved, 0);
  const totalPiiMasked = requestLogs.reduce((sum, r) => sum + r.piiRedacted, 0);

  const avgLatencyMs =
    totalRequests === 0
      ? 0
      : Math.round(
          requestLogs.reduce((sum, r) => sum + r.latencyMs, 0) / totalRequests
        );

  return {
    summary: {
      totalRequests,
      cacheHits,
      cacheMisses,
      cacheHitRate,
      totalTokensSpent,
      totalTokensSaved,
      totalPiiMasked,
      avgLatencyMs,
    },
    recentLogs: requestLogs.slice(-10).reverse(), // Show newest 10 requests first
  };
}