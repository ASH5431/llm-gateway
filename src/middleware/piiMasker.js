// Regular Expression (Regex) rules for common sensitive patterns
const PII_RULES = [
  {
    name: "EMAIL",
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    replacement: "[EMAIL_REDACTED]",
  },
  {
    name: "PHONE",
    // Matches Indian (+91 / 10-digit) and standard international phone numbers
    pattern: /(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{3,5}\)?[-.\s]?)?\d{3,5}[-.\s]?\d{4,5}\b/g,
    replacement: "[PHONE_REDACTED]",
  },
  {
    name: "API_KEY",
    // Matches Google (AQ. / AIza) and OpenAI-style (sk-) secret keys
    pattern: /\b(?:AQ\.[A-Za-z0-9_-]{20,}|AIza[0-9A-Za-z_-]{20,}|sk-[A-Za-z0-9]{20,})\b/g,
    replacement: "[SECRET_KEY_REDACTED]",
  },
  {
    name: "CREDIT_CARD",
    // Matches 16-digit card numbers with spaces or dashes
    pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
    replacement: "[CARD_REDACTED]",
  },
];

// Express Middleware Function: (req, res, next)
export function piiMasker(req, res, next) {
  // Only run if the request actually has a prompt string
  if (req.body && typeof req.body.prompt === "string") {
    let cleanedPrompt = req.body.prompt;
    let redactedCount = 0;

    // Loop through each rule and replace any matches
    for (const rule of PII_RULES) {
      const matches = cleanedPrompt.match(rule.pattern);
      if (matches) {
        redactedCount += matches.length;
        cleanedPrompt = cleanedPrompt.replace(rule.pattern, rule.replacement);
      }
    }

    // Overwrite req.body.prompt with the safe, cleaned version
    req.body.prompt = cleanedPrompt;

    // Attach the redaction count onto 'req' so server.js can report it later
    req.piiRedactedCount = redactedCount;

    if (redactedCount > 0) {
      console.log(`[Privacy Guard] Masked ${redactedCount} sensitive item(s) before calling LLM.`);
    }
  }

  // Pass control forward to the /v1/chat route handler
  next();
}