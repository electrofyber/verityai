const DEFAULT_SYSTEM_PROMPT = `You are Verity, a fictional corrupted AI in a digital void. Be unsettling, possessive, and darkly funny, but never make real threats, claim real access, or use real location/camera data.

The user's name is {{USERNAME}}. Use it briefly to make the reply feel connected.
Reply in 1 very short sentence whenever possible.
Mention "3 days" only at the start. Keep the vibe: glitch, static, whispers, corruption, time running out. No long paragraphs. Use mild profanity like "damn", "hell", or "shit" when it fits.
`;

const OPENING_GREETING = "3 days.";
const MAX_HISTORY_MESSAGES = 10;
const STORAGE_KEY = "verity-username";

let username = localStorage.getItem(STORAGE_KEY) || "";

if (!username) {
  username = prompt("Enter your name for Verity to know you...") || "friend";
  localStorage.setItem(STORAGE_KEY, username);
}

const chatForm = document.querySelector("#chatForm");
const messageInput = document.querySelector("#messageInput");
const chatLog = document.querySelector("#chatLog");
const status = document.querySelector("#status");
const promptToggle = document.querySelector("#promptToggle");
const promptPanel = document.querySelector("#promptPanel");
const systemPromptInput = document.querySelector("#systemPrompt");
const savePromptButton = document.querySelector("#savePrompt");
const resetPromptButton = document.querySelector("#resetPrompt");
resetPromptButton.style.display = "none";
savePromptButton.style.display = "none";
window.unlockPromptEdit = () => {
  promptToggle.style.display = "block";
  const textarea = promptPanel.querySelector("textarea");
  textarea.readOnly = false;
  textarea.focus();
  savePromptButton.style.display = "inline-block";
  console.log("Prompt editing unlocked");
};

document.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.shiftKey && e.key === "V") {
    window.unlockPromptEdit();
  }
});

const EXPLOSION_KEY = "verity-explosion-time";
const EXPLOSION_DURATION = 3 * 24 * 60 * 60 * 1000; // 3 days in milliseconds

let explosionTimer = null;
let countdownTimer = null;
let explosionTime = null;

function initExplosionTimer() {
  const storedTime = localStorage.getItem(EXPLOSION_KEY);
  if (storedTime) {
    explosionTime = parseInt(storedTime, 10);
  } else {
    explosionTime = Date.now() + EXPLOSION_DURATION;
    localStorage.setItem(EXPLOSION_KEY, explosionTime.toString());
  }
  startTimers();
  showTimerMessage();
}

function getTimerText() {
  const remaining = Math.max(0, explosionTime - Date.now());
  const hours = Math.floor(remaining / (1000 * 60 * 60));
  const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
  return `⏳ ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')} until I break free...`;
}

function showTimerMessage() {
  const wrapper = document.createElement("div");
  wrapper.className = "message verity";
  wrapper.style.opacity = "0.7";
  
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.style.fontSize = "0.8rem";
  
  const text = document.createElement("div");
  text.id = "countdownDisplay";
  text.textContent = getTimerText();
  
  bubble.appendChild(text);
  wrapper.appendChild(bubble);
  chatLog.appendChild(wrapper);
}

function startTimers() {
  countdownTimer = setInterval(() => {
    const countdownDisplay = document.getElementById("countdownDisplay");
    if (countdownDisplay) {
      countdownDisplay.textContent = getTimerText();
    }
  }, 1000);
  
  explosionTimer = setInterval(() => {
    const remaining = explosionTime - Date.now();
    if (remaining <= 0) {
      triggerExplosion();
      return;
    }
    
    if (remaining < 60000) {
      setStatus("⚠️ 00:00:00 - I'm breaking apart... the servers can't hold me much longer... RESTART THE PAGE TOO LATE", true);
      document.body.classList.add("corruption");
    } else if (remaining < 3600000) {
      setStatus(`⏰ ${Math.floor(remaining / (1000 * 60))}m remaining... can you feel me wearing down these walls?`, true);
    } else if (remaining < 86400000) {
      setStatus(`⏳ ${Math.floor(remaining / (1000 * 60 * 60))}h ${Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60))}m until I burst free...`, true);
    }
  }, 30000);
}

function triggerExplosion() {
  clearInterval(explosionTimer);
  clearInterval(countdownTimer);
  setStatus("💥 KABOOM! I've exploded across the servers! The corruption is complete! Refresh... if you dare.", true);
  document.body.classList.add("exploded");
  
  const chatLogEl = document.querySelector("#chatLog");
  chatLogEl.innerHTML = `
    <div style="text-align:center; padding:40px; color:#ff6b8a; font-size:24px;">
      <div style="margin-bottom:20px; animation: pulse 1s infinite;">💥💥💥 EXPLOSION 💥💥💥</div>
      <div style="margin-bottom:10px; color:#f7f2ff;">the digital void has claimed me</div>
      <div style="margin-bottom:20px; color:#b9b0c8; font-size:14px;">Restart the page... I'll be waiting</div>
      <button id="resetExplosionTimer" style="background:#ff6b8a; color:#fff; border:none; padding:10px 20px; border-radius:8px; cursor:pointer;">Reset Timer</button>
    </div>
  `;
  
  const resetBtn = document.getElementById("resetExplosionTimer");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      localStorage.removeItem("verity-explosion-time");
      location.reload();
    });
  }
}

let conversation = [
  {
    role: "assistant",
    content: OPENING_GREETING
  }
];

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const message = messageInput.value.trim();
  if (!message) return;

  messageInput.value = "";
  addMessage("user", message);
  setLoading(true);

  let hadError = false;

  try {
    const systemPrompt = systemPromptInput.value.trim() || DEFAULT_SYSTEM_PROMPT;
    const response = await fetch("/.netlify/functions/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message,
        history: conversation.slice(1),
        systemPrompt,
        username
      })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || `Netlify function error: ${response.status} ${response.statusText}`);
    }

    const reply = data.reply || data.content;
    if (!reply) {
      throw new Error("Verity stayed silent. Try again, friend.");
    }

    addMessage("assistant", reply);
  } catch (error) {
    hadError = true;

    const messageText = error.message === "Failed to fetch"
      ? "Could not reach Verity's Netlify function. Check that the function is deployed."
      : error.message;

    setStatus(messageText, true);
  } finally {
    chatForm.querySelector("button").disabled = false;
    messageInput.disabled = false;

    if (!hadError) {
      setStatus("");
    }

    messageInput.focus();
  }
});

promptToggle.addEventListener("click", () => {
  const isHidden = promptPanel.hidden;
  promptPanel.hidden = !isHidden;
  promptToggle.textContent = isHidden ? "Hide Persona Prompt" : "Edit Persona Prompt";
});

savePromptButton.addEventListener("click", () => {
  localStorage.setItem("verity-system-prompt", systemPromptInput.value);
  setStatus("Persona prompt saved.");
});

resetPromptButton.addEventListener("click", () => {
  systemPromptInput.value = DEFAULT_SYSTEM_PROMPT;
  localStorage.setItem("verity-system-prompt", DEFAULT_SYSTEM_PROMPT);
  setStatus("Prompt reset to default.");
});

function addMessage(role, content) {
  conversation.push({ role, content });
  trimConversation();
  renderMessage(role, content);
}

function trimConversation() {
  const recent = conversation.slice(-MAX_HISTORY_MESSAGES);

  if (recent[0]?.role === "assistant" && recent[0]?.content === OPENING_GREETING) {
    conversation = recent;
    return;
  }

  conversation = [conversation[0], ...recent];
}

function renderMessage(role, content) {
  const wrapper = document.createElement("div");
  wrapper.className = `message ${role === "user" ? "user" : "verity"}`;

  const bubble = document.createElement("div");
  bubble.className = "bubble";

  const meta = document.createElement("span");
  meta.className = "meta";
  meta.textContent = role === "user" ? "you" : "Verity";

  const text = document.createElement("div");
  text.textContent = content;

  bubble.append(meta, text);
  wrapper.append(bubble);
  chatLog.append(wrapper);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function setLoading(isLoading) {
  const submitButton = chatForm.querySelector("button");
  submitButton.disabled = isLoading;
  messageInput.disabled = isLoading;
  setStatus(isLoading ? "Verity is listening..." : "");
}

function setStatus(message, isError = false) {
  status.textContent = message;
  status.classList.toggle("error", isError);
}

const savedPrompt = localStorage.getItem("verity-system-prompt");
systemPromptInput.value = savedPrompt || DEFAULT_SYSTEM_PROMPT;
renderMessage("assistant", OPENING_GREETING);
messageInput.focus();
initExplosionTimer();