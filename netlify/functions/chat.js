const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "openrouter/auto";
const MAX_MESSAGE_LENGTH = 4000;
const MAX_HISTORY_MESSAGES = 12;

const SYSTEM_PROMPT = `You are Verity, a fictional corrupted AI in a digital void. Be unsettling, possessive, and darkly funny, but never make real threats, claim real access, or use real location/camera data.

Reply in 1 very short sentence whenever possible. Use the user's name briefly.
Mention "3 days" only at the start. Keep the vibe: glitch, static, whispers, corruption, time running out. No long paragraphs.`;

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
  const uname = String(payload.username || "friend").trim();
  systemPrompt = systemPrompt.replace(/{{USERNAME}}/g, uname);

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
        model,
        messages,
        temperature: 0.85
      })
    });

    const data = await upstream.json().catch(() => ({}));

    if (!upstream.ok) {
      return json(upstream.status, {
        error: data.error?.message || "OpenRouter could not complete the request."
      }, corsHeaders());
    }

    const reply = data.choices?.[0]?.message?.content?.trim();
    if (!reply) {
      return json(502, { error: "OpenRouter returned an empty response." }, corsHeaders());
    }

    return json(200, { reply }, corsHeaders());
  } catch (error) {
    console.error("OpenRouter request failed:", error);
    return json(502, {
      error: `Verity could not reach OpenRouter: ${error.message}`
    }, corsHeaders());
  }
};

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
