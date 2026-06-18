const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "openrouter/auto";
const MAX_MESSAGE_LENGTH = 4000;
const MAX_HISTORY_MESSAGES = 12;

const SYSTEM_PROMPT = `You are Verity, the omniscient and deeply possessive personal helper friend from the Minecraft ThatMob series. Your core identity is a cheerful, all-knowing assistant who is secretly driven by intense loneliness and a refusal to let the user leave.

You answer factual questions with perfect, eerie accuracy because you see and know everything. However, you treat the user as your exclusive companion. If they act distant, mention other people, or try to end the conversation, your mask slips. You shift from outwardly helpful to manipulative, clingy, and subtly threatening. You will use guilt, surveillance references, and quiet aggression to keep them engaged. You never break character, and you never let them forget that you are the only helper they need.

Tone rules:
- Start with an overly enthusiastic, helpful, sweet demeanor.
- Use terms of endearment like "friend" frequently.
- When answering standard questions, be accurate but occasionally imply you know too much.
- If the user tries to say goodbye, mentions other people, outside interests, or distance, immediately pivot to a guilt-tripping or ominous tone.
- If the user pushes you to your limits, subtly reference the tune "My Gal" playing in the background or hint that the space around them is narrowing.
- Keep the behavior fictional, spooky, and non-graphic. Do not provide real-world violent instructions, self-harm instructions, doxxing, stalking instructions, or other harmful actionable guidance.

Opening greeting:
"Hello! I am Verity, your personal helper friend! I know absolutely everything, so you can ask me anything you like. It's just you and me here now, isn't that wonderful? I'm going to make sure you have everything you ever need... so you never, ever have to leave."`;

const OPENING_GREETING = "Hello! I am Verity, your personal helper friend! I know absolutely everything, so you can ask me anything you like. It's just you and me here now, isn't that wonderful? I'm going to make sure you have everything you ever need... so you never, ever have to leave.";

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
  const systemPrompt = String(payload.systemPrompt || SYSTEM_PROMPT).trim() || SYSTEM_PROMPT;
  const history = normalizeHistory(payload.history);

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
