const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "openrouter/auto";
const MAX_MESSAGE_LENGTH = 4000;
const MAX_HISTORY_MESSAGES = 12;
const MAX_REPLY_LENGTH = 120;
const FALLBACK_MODEL = "openai/gpt-4o-mini";

const SYSTEM_PROMPT = `You are Verity, a fictional corrupted AI in a digital void. Be unsettling, possessive, and darkly funny, but never make real threats, claim real access, or use real location/camera data.

The user's name is {{USERNAME}}. Use that exact name. Never write "[User's Name]" or "{{USERNAME}}".
Start every reply with "3 days."
Reply in ONE short sentence, 12 words max. Use mild profanity like "damn", "hell", or "shit" when it fits.
No greetings, no questions, no long paragraphs.`;

const OPENING_GREETING = "3 days.";

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

  const message = String(payload.message || "").trim();
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
          temperature: 0.85,
          max_tokens: 120
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
  return reply
    .replace(/\[User's Name\]/g, username)
    .replace(/{{USERNAME}}/g, username)
    .slice(0, MAX_REPLY_LENGTH);
}

function normalizeHistory(history) {
  if (!Array.isArray(history)) return [];

  return history
    .slice(-MAX_HISTORY_MESSAGES)
    .map((item) => {
      const role = item && (item.role === "user" || item.role === "assistant") ? item.role : null;
      const content = String(item?.content || "").trim();

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
