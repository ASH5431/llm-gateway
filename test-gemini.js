import dotenv from "dotenv";

dotenv.config();

// Fastest & highest-capacity free models first, with backups ready
const models = [
  "gemini-3.5-flash-lite",
  "gemini-3.6-flash",
  "gemini-3.8-flash",
];

async function askGemini(prompt) {
  for (const model of models) {
    console.log(`Trying model: ${model}...`);

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
        // Stop waiting automatically if this model takes more than 8 seconds
        signal: AbortSignal.timeout(8000),
      });

      const data = await response.json();

      // If the model succeeded (Status 200), print the answer and stop!
      if (response.ok) {
        console.log(`Success with ${model}! (Status: ${response.status})`);
        console.log("Reply:", data.candidates?.[0]?.content?.parts?.[0]?.text);
        return;
      }

      // If busy (503) or rate-limited (429), switch to the next model
      if (response.status === 503 || response.status === 429) {
        console.log(`${model} is busy (${response.status}). Switching to backup...`);
        continue;
      }

      // Any other API error (such as an invalid key)
      console.log("API Error:", response.status, data);
      return;
    } catch (err) {
      // Catches 8-second timeouts or network drops so the script never crashes
      console.log(`${model} timed out or failed (${err.name}). Switching to backup...`);
      continue;
    }
  }

  console.log("All backup models failed right now. Please try again in a minute.");
}

await askGemini("Say hello in one short sentence!");