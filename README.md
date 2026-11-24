# LLM Gateway Control Plane

A lightweight, fault-tolerant reverse proxy and observability gateway for Large Language Models built with **Node.js** and **Express**. Designed to sit between client applications and external LLM providers to enforce data privacy, cut token spend via caching, prevent downtime through multi-model failover, and track real-time telemetry.

**Live Demo & Control Plane:** https://llm-gateway-ash.onrender.com

## Request Pipeline Architecture

```text
Client Request (POST /v1/chat)
       │
       ▼
1. PII Redaction Middleware (piiMasker.js)
   └─ Masks emails, phone numbers, credit cards, and API keys via Regex
       │
       ▼
2. In-Memory Cache Layer (cache.js)
   └─ Normalizes prompt → SHA-256 fingerprint → 60s TTL lookup (<2ms, 0 tokens)
       │ (on Cache Miss)
       ▼
3. Multi-Model Failover Engine (server.js)
   └─ Routes sequentially across Gemini models with 8s AbortSignal timeouts
       │
       ▼
4. Telemetry & Observability Logger (telemetry.js)
   └─ Streams structured metrics to RAM (/v1/stats) and persistent JSONL logs
```

## Key Features

- **Automated PII Guardrails:** Sanitizes sensitive customer details (`[EMAIL_REDACTED]`, `[PHONE_REDACTED]`, `[SECRET_KEY_REDACTED]`, `[CARD_REDACTED]`) before any payload leaves the server.
- **Zero-Token Exact Caching:** Uses `node:crypto` SHA-256 hashing on normalized, PII-masked prompts so repeated queries return in `<2 ms` at zero token cost.
- **Resilient Model Failover:** Automatically handles `429` rate limits, `503` overload errors, and hung connections (`AbortSignal.timeout(8000)`) by failing over across fallback models.
- **Live Observability Dashboard:** Tracks cache hit rate, tokens spent vs. tokens saved, blocked PII leaks, and end-to-end latency via `GET /v1/stats` and an interactive web UI.

## API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/` | Interactive Control Plane & Prompt Playground UI |
| `POST` | `/v1/chat` | Main gateway endpoint (`{ "prompt": "..." }`) |
| `GET` | `/v1/stats` | Aggregated KPI summary and recent request telemetry |
| `GET` | `/health` | Service health check |

## Local Setup

```bash
git clone [https://github.com/ASH5431/llm-gateway.git](https://github.com/ASH5431/llm-gateway.git)
cd llm-gateway
npm install
echo GEMINI_API_KEY=your_api_key_here > .env
npm start
```