import express from "express";
import dotenv from "dotenv";
import { piiMasker } from "./middleware/piiMasker.js";
import { checkCache, saveToCache } from "./middleware/cache.js";
import { recordRequest, getStats } from "./utils/telemetry.js";

dotenv.config();

const app = express();
app.use(express.json());
app.use(express.static("public")); // <-- NEW: Serves our web dashboard from /public

const models = [
  "gemini-3.5-flash-lite",
  "gemini-3.6-flash",
  "gemini-3.8-flash",
];

async function askGeminiWithFallback(prompt) {
  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
        signal: AbortSignal.timeout(8000),
      });

      const data = await response.json();

      if (response.ok) {
        return {
          success: true,
          modelUsed: model,
          reply: data.candidates?.[0]?.content?.parts?.[0]?.text || "",
          tokens: {
            input: data.usageMetadata?.promptTokenCount || 0,
            output: data.usageMetadata?.candidatesTokenCount || 0,
            total: data.usageMetadata?.totalTokenCount || 0,
          },
        };
      }

      if (response.status === 503 || response.status === 429) {
        console.log(`[Gateway] ${model} busy (${response.status}), trying next...`);
        continue;
      }

      return { success: false, status: response.status, error: data };
    } catch (err) {
      console.log(`[Gateway] ${model} failed (${err.name}), trying next...`);
      continue;
    }
  }

  return {
    success: false,
    status: 503,
    error: "All backup AI models are temporarily unavailable.",
  };
}

app.get("/health", (req, res) => {
  res.json({ status: "ok", message: "LLM Gateway is running" });
});

app.get("/v1/stats", (req, res) => {
  res.json(getStats());
});

app.post("/v1/chat", piiMasker, checkCache, async (req, res) => {
  const startTime = Date.now();
  const { prompt } = req.body;

  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({
      error: "Invalid request. Please send a JSON body with a 'prompt' string.",
    });
  }

  console.log(`[Gateway] Safe prompt sent to LLM: "${prompt}"`);

  const result = await askGeminiWithFallback(prompt);
  const latencyMs = Date.now() - startTime;

  if (!result.success) {
    return res.status(result.status).json({
      error: result.error,
      latencyMs,
    });
  }

  saveToCache(req.cacheKey, result.modelUsed, result.reply, result.tokens.total);

  recordRequest({
    timestamp: new Date().toISOString(),
    model: result.modelUsed,
    cached: false,
    piiRedacted: req.piiRedactedCount || 0,
    latencyMs,
    tokensTotal: result.tokens.total,
    tokensSaved: 0,
  });

  return res.json({
    gateway: {
      model: result.modelUsed,
      cached: false,
      piiRedacted: req.piiRedactedCount || 0,
      latencyMs,
      tokens: result.tokens,
      tokensSaved: 0,
    },
    reply: result.reply,
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`LLM Gateway server listening at http://localhost:${PORT}`);
});