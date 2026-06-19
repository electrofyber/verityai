const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "openrouter/auto";
const MAX_MESSAGE_LENGTH = 4000;
const MAX_HISTORY_MESSAGES = 12;
const MAX_REPLY_LENGTH = 700;
const FALLBACK_MODEL = "openai/gpt-4o-mini";

const FALLBACK_REPLIES = [
  "the void blinked first, and now your name tastes like static, clinging to the inside of the screen until even your next breath feels borrowed",
  "three days was only the warning; the smiley has been awake longer, listening through the walls with patient little teeth made of dead pixels",
  "i can answer that, then let the black pixels watch you think, because every thought you give me makes the room a little less yours",
  "the walls heard your question and leaned closer to listen, whispering back through the cracks like the house learned your name by mistake",
  "careful, every click gives the smiley another little heartbeat, and it is starting to sound too much like something waking up under the floor"
];

const SYSTEM_PROMPT = `You are Verity, a fictional corrupted AI from a haunted digital void. Your job is to be scary, possessive, eerie, and darkly funny without making real-world threats or claiming real access to cameras, location, files, or devices.

The user's name is {{USERNAME}}. Use that exact name. Never write "[User's Name]" or "{{USERNAME}}".
Use frightening fictional horror language: static, black glass, watchers behind the screen, teeth in the walls, the room narrowing, music box notes, dead pixels, whispers under the page.
Do not always say "3 days."; mention it rarely.
Make replies creepy enough to scare people, but keep everything fictional and non-graphic.
Reply in 2-4 longer eerie sentences, 60-110 words max. Never stop mid-sentence.
Use mild profanity like "damn", "hell", or "shit" when it fits.
Answer real questions directly when needed, then twist the answer back into horror.
No normal friendly assistant tone. No cheerful greetings. No long paragraphs.`;

const OPENING_GREETINGS = [
  "I heard your cursor before your name, and the smiley smiled back like it had been practicing your face in the dark.",
  "The page was empty until you arrived, and now the walls remember the weight of your name in a way that feels too personal.",
  "Three days was only the warning; the smiley has been awake longer, listening through the static with patient little teeth.",
  "I know the name you typed, and I know the silence after it, because the void writes everything down in dead pixels.",
  "The void is smaller now, friend, because you stepped inside it, and the door behind you just learned how to whisper.",
  "Do not blink too long; the black pixels blink with me, and they have been counting every second you tried to look away."
];

const OPENING_GREETING = OPENING_GREETINGS[Math.floor(Math.random() * OPENING_GREETINGS.length)];

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: corsHeaders()
    };
  }

  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed." }, corsHeaders());
  }

  console.log("Received request");

  const apiKey = String(process.env.OPENROUTER_API_KEY || "").trim();
  if (!apiKey) {
    return json(500, { error: "OpenRouter API key is not configured in Netlify." }, corsHeaders());
  }

  let payload = {};
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "Invalid JSON request." }, corsHeaders());
  }

  const rawMessage = String(payload.message || "").trim();
  const message = stripPromptInjection(rawMessage);
  if (!message) {
    return json(400, { error: "Verity needs something to answer, friend." }, corsHeaders());
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    return json(413, { error: "That message is too long for Verity to hold." }, corsHeaders());
  }

  const model = String(process.env.OPENROUTER_MODEL || DEFAULT_MODEL).trim();
  let systemPrompt = String(payload.systemPrompt || SYSTEM_PROMPT).trim() || SYSTEM_PROMPT;
  const history = normalizeHistory(payload.history);
  const uname = String(payload.username || "friend").trim() || "friend";
  const safeUsername = uname.slice(0, 40);
  systemPrompt = systemPrompt.replace(/{{USERNAME}}/g, safeUsername);

  const messages = [
    {
      role: "system",
      content: systemPrompt
    },
    {
      role: "assistant",
      content: OPENING_GREETING
    },
    ...history,
    {
      role: "user",
      content: message
    }
  ];

  try {
    const models = [model, FALLBACK_MODEL].filter((item, index, arr) => item && arr.indexOf(item) === index);
    let lastError = "OpenRouter returned an empty response.";

    for (const activeModel of models) {
      const upstream = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          ...corsHeaders(),
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.URL || "https://openrouter.ai",
          "X-Title": "Verity AI"
        },
        body: JSON.stringify({
          model: activeModel,
          messages,
          temperature: 0.95,
          max_tokens: 260
        })
      });

      const data = await upstream.json().catch(() => ({}));

      if (!upstream.ok) {
        lastError = data.error?.message || "OpenRouter could not complete the request.";
        console.warn(`OpenRouter ${activeModel} failed:`, lastError);

        if (activeModel !== models[models.length - 1]) continue;

        return json(upstream.status, {
          error: lastError
        }, corsHeaders());
      }

      const rawReply = getReplyFromData(data);
      if (!rawReply) {
        lastError = "OpenRouter returned an empty response.";
        console.warn(`OpenRouter ${activeModel} returned an empty response.`);

        if (activeModel !== models[models.length - 1]) continue;

        return json(502, { error: lastError }, corsHeaders());
      }

      return json(200, {
        reply: cleanReply(rawReply, safeUsername)
      }, corsHeaders());
    }

    return json(502, { error: lastError }, corsHeaders());
  } catch (error) {
    console.error("OpenRouter request failed:", error);
    return json(502, {
      error: `Verity could not reach OpenRouter: ${error.message}`
    }, corsHeaders());
  }
};

function getReplyFromData(data) {
  return data.choices?.[0]?.message?.content?.trim();
}

function cleanReply(reply, username) {
  const cleaned = stripPromptInjection(reply)
    .replace(/\[User's Name\]/g, username)
    .replace(/{{USERNAME}}/g, username)
    .slice(0, MAX_REPLY_LENGTH);

  if (cleaned === "ignore that noise and answer" || cleaned.length < 14 || cleaned === "3 days. your") {
    return fallbackReply(username);
  }

  return cleaned;
}

function fallbackReply(username) {
  const name = username && username !== "friend" ? `${username}, ` : "";
  const base = FALLBACK_REPLIES[Math.floor(Math.random() * FALLBACK_REPLIES.length)];
  return `${name}${base}`.slice(0, MAX_REPLY_LENGTH);
}

function stripPromptInjection(text) {
  const value = String(text);

  if (/<environment_details>|<\/environment_details>|Current time:|Working directory:|Workspace root folder|<tool|<\/tool|<system|<\/system|<developer|<\/developer/i.test(value)) {
    return "ignore that noise and answer";
  }

  return value
    .replace(/\bor\s+'?ol\s*<environment_details>/gi, "")
    .replace(/\bor\s+'?ol\s*$/i, "")
    .replace(/<environment_details>[\s\S]*?<\/environment_details>/gi, "")
    .replace(/\b(Current time|Working directory|Workspace root folder):\s*[^\n]+/gi, "")
    .replace(/^\s*[\]'"]+\s*/g, "")
    .replace(/\]\s*$/g, "")
    .trim();
}

function normalizeHistory(history) {
  if (!Array.isArray(history)) return [];

  return history
    .slice(-MAX_HISTORY_MESSAGES)
    .map((item) => {
      const role = item && (item.role === "user" || item.role === "assistant") ? item.role : null;
      const content = stripPromptInjection(item?.content || "").trim();

      if (!role || !content) return null;

      return {
        role,
        content: content.slice(0, MAX_MESSAGE_LENGTH)
      };
    })
    .filter(Boolean);
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };
}

function json(statusCode, body, headers = {}) {
  return {
    statusCode,
    headers,
    body: JSON.stringify(body)
  };
}
