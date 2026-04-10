const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { fileURLToPath } = require("url");

const __filename = typeof __filename !== 'undefined' ? __filename : fileURLToPath(import.meta.url);
const __dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT || 3001);
const API_PREFIX = "/api";

app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "1mb" }));

const DATA_DIR = path.join(__dirname, "data");
const STATE_FILE = path.join(DATA_DIR, "state.json");

const CHANNELS = [
  { name: "#general", mood: 78, unread: 2 },
  { name: "#emergencies", mood: 36, unread: 4 },
  { name: "#carbon-reports", mood: 69, unread: 1 },
  { name: "#team-pulse", mood: 82, unread: 0 }
];

const BASE_MESSAGES = [
  {
    id: 1,
    user: "Alex K",
    initials: "AK",
    color: "#0A84FF",
    time: "9:41 AM",
    text: "Morning team! Deployment went smooth overnight 🚀",
    reactions: ["👏 3", "🚀 2"],
    translated: false
  },
  {
    id: 2,
    user: "Maria G",
    initials: "MG",
    color: "#BF5AF2",
    time: "9:43 AM",
    text: "Great news! The carbon report for Q1 is ready to review.",
    reactions: ["✅ 5"],
    translated: true,
    lang: "🇪🇸"
  },
  {
    id: 3,
    user: "Jin Park",
    initials: "JP",
    color: "#30D158",
    time: "9:47 AM",
    text: "Mesh network held up perfectly during the conference. 6 nodes, zero drops.",
    reactions: ["💪 4", "🔥 2"],
    translated: false
  },
  {
    id: 4,
    user: "Sara M",
    initials: "SM",
    color: "#FF9F0A",
    time: "9:52 AM",
    text: "Reminder: accessibility audit call at 11. Bring your findings!",
    reactions: ["👍 6"],
    translated: false
  }
];

const DEFAULT_MESSAGES_BY_CHANNEL = {
  "#general": BASE_MESSAGES,
  "#emergencies": [
    {
      id: 101,
      user: "Ops Bot",
      initials: "OB",
      color: "#FF453A",
      time: "9:20 AM",
      text: "Incident bridge opened. Confirm on-call responders in the next 5 minutes.",
      reactions: ["🚨 5", "✅ 3"],
      translated: false
    },
    {
      id: 102,
      user: "Sara M",
      initials: "SM",
      color: "#FF9F0A",
      time: "9:28 AM",
      text: "Cellular degradation detected in Zone C. Mesh fallback is active.",
      reactions: ["📡 2", "👍 4"],
      translated: false
    }
  ],
  "#carbon-reports": [
    {
      id: 201,
      user: "Maria G",
      initials: "MG",
      color: "#BF5AF2",
      time: "8:57 AM",
      text: "Uploaded Q1 emissions baseline and regional variance breakdown.",
      reactions: ["📊 4", "✅ 2"],
      translated: true,
      lang: "🇪🇸"
    },
    {
      id: 202,
      user: "Alex K",
      initials: "AK",
      color: "#0A84FF",
      time: "9:11 AM",
      text: "Please review commute assumptions before we lock the summary deck.",
      reactions: ["👀 3"],
      translated: false
    }
  ],
  "#team-pulse": [
    {
      id: 301,
      user: "Jin Park",
      initials: "JP",
      color: "#30D158",
      time: "9:02 AM",
      text: "Energy is trending high after the launch update. Great momentum this morning.",
      reactions: ["🔥 6", "💪 2"],
      translated: false
    },
    {
      id: 302,
      user: "People Ops",
      initials: "PO",
      color: "#5B3FD4",
      time: "9:15 AM",
      text: "Reminder: share one unblocker in today's pulse check-in.",
      reactions: ["🧠 3", "✅ 4"],
      translated: false
    }
  ]
};

const INCOMING_MESSAGE_BANK = {
  "#general": [
    "Can someone validate the rollout metric trend for APAC?",
    "Customer health score refreshed. No new critical alerts.",
    "Drafted summary for leadership review, feedback welcome."
  ],
  "#emergencies": [
    "Latency spike detected in failover path. Monitoring active.",
    "Zone B recovered. Keeping mesh bridge online for 10 more minutes.",
    "Incident command requests final status confirmation from field devices."
  ],
  "#carbon-reports": [
    "Daily transport log imported successfully.",
    "Remote-work delta improved by 2.4% since yesterday.",
    "Please verify facility energy offsets for compliance."
  ],
  "#team-pulse": [
    "Pulse score uplift recorded after standup.",
    "Noise floor in #general dropped back to baseline.",
    "Engagement trend holds steady across EMEA and US teams."
  ]
};

const INCOMING_AUTHORS = [
  { user: "NOC Bot", initials: "NB", color: "#FF9F0A" },
  { user: "Relay Bot", initials: "RB", color: "#0A84FF" },
  { user: "Maria G", initials: "MG", color: "#BF5AF2" },
  { user: "Jin Park", initials: "JP", color: "#30D158" }
];

const CULTURE_ADAPTATIONS = {
  British: "Best of luck.",
  Japanese: "頑張ってください。",
  German: "Viel Erfolg!",
  Brazilian: "Boa sorte!",
  Arabic: "بالتوفيق!",
  Bulgarian: "Много успех!",
  American: "You got this!"
};

const DEFAULT_UNREAD_BY_CHANNEL = CHANNELS.reduce((accumulator, channel) => {
  accumulator[channel.name] = channel.unread;
  return accumulator;
}, {});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function nowTime() {
  return new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function getMaxMessageId(messagesByChannel) {
  let maxId = 0;
  Object.values(messagesByChannel).forEach((messages) => {
    (messages || []).forEach((message) => {
      if (typeof message.id === "number" && message.id > maxId) {
        maxId = message.id;
      }
    });
  });
  return maxId;
}

function createInitialState() {
  const messagesByChannel = clone(DEFAULT_MESSAGES_BY_CHANNEL);
  return {
    channels: CHANNELS.map((channel) => ({ name: channel.name, mood: channel.mood })),
    messagesByChannel,
    channelUnread: { ...DEFAULT_UNREAD_BY_CHANNEL },
    lastId: getMaxMessageId(messagesByChannel)
  };
}

function ensureStorage() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(STATE_FILE)) {
    fs.writeFileSync(STATE_FILE, JSON.stringify(createInitialState(), null, 2), "utf8");
  }
}

function normalizeState(rawState) {
  const state = rawState && typeof rawState === "object" ? rawState : createInitialState();

  if (!state.channels || !Array.isArray(state.channels)) {
    state.channels = CHANNELS.map((channel) => ({ name: channel.name, mood: channel.mood }));
  }

  if (!state.messagesByChannel || typeof state.messagesByChannel !== "object") {
    state.messagesByChannel = clone(DEFAULT_MESSAGES_BY_CHANNEL);
  }

  CHANNELS.forEach((channel) => {
    if (!Array.isArray(state.messagesByChannel[channel.name])) {
      state.messagesByChannel[channel.name] = [];
    }
  });

  if (!state.channelUnread || typeof state.channelUnread !== "object") {
    state.channelUnread = { ...DEFAULT_UNREAD_BY_CHANNEL };
  }

  CHANNELS.forEach((channel) => {
    if (typeof state.channelUnread[channel.name] !== "number") {
      state.channelUnread[channel.name] = 0;
    }
  });

  if (typeof state.lastId !== "number") {
    state.lastId = getMaxMessageId(state.messagesByChannel);
  }

  return state;
}

function loadState() {
  ensureStorage();

  try {
    const raw = fs.readFileSync(STATE_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return normalizeState(parsed);
  } catch (error) {
    const initial = createInitialState();
    fs.writeFileSync(STATE_FILE, JSON.stringify(initial, null, 2), "utf8");
    return initial;
  }
}

let state = loadState();

function saveState() {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf8");
}

function getPublicState() {
  return {
    channels: state.channels,
    messagesByChannel: state.messagesByChannel,
    channelUnread: state.channelUnread
  };
}

function isValidChannel(channelName) {
  return CHANNELS.some((channel) => channel.name === channelName);
}

function parseReactionValue(reaction) {
  const split = String(reaction || "").split(" ");
  return {
    emoji: split[0],
    count: Number.parseInt(split[1], 10) || 0
  };
}

function normalizeCultureLabel(value) {
  const raw = String(value || "").trim();

  if (!raw) {
    return "";
  }

  const parts = raw.split(/\s+/);

  // Support labels both with and without leading flag emoji, e.g. "🇧🇬 Bulgarian" vs "Bulgarian".
  if (parts.length > 1 && !/[A-Za-z]/.test(parts[0])) {
    return parts.slice(1).join(" ");
  }

  return raw;
}

function incrementReaction(reactions, emoji) {
  const next = [...(Array.isArray(reactions) ? reactions : [])];
  const index = next.findIndex((item) => String(item).startsWith(`${emoji} `));

  if (index === -1) {
    next.push(`${emoji} 1`);
    return next;
  }

  const parsed = parseReactionValue(next[index]);
  next[index] = `${emoji} ${parsed.count + 1}`;
  return next;
}

function appendMessage(channelName, message) {
  if (!Array.isArray(state.messagesByChannel[channelName])) {
    state.messagesByChannel[channelName] = [];
  }
  state.messagesByChannel[channelName].push(message);
}

app.get(`${API_PREFIX}/health`, (request, response) => {
  response.json({ ok: true, service: "spann-api", time: new Date().toISOString() });
});

app.get(`${API_PREFIX}/chat/state`, (request, response) => {
  response.json({ state: getPublicState() });
});

app.get(`${API_PREFIX}/chat/channels`, (request, response) => {
  const moodByName = new Map(state.channels.map((channel) => [channel.name, channel.mood]));
  const channels = CHANNELS.map((channel) => ({
    name: channel.name,
    mood: moodByName.get(channel.name) ?? channel.mood,
    unread: state.channelUnread[channel.name] ?? 0
  }));

  response.json({ channels });
});

app.get(`${API_PREFIX}/chat/messages/:channel`, (request, response) => {
  const channelName = decodeURIComponent(request.params.channel);

  if (!isValidChannel(channelName)) {
    response.status(404).json({ error: "Unknown channel" });
    return;
  }

  response.json({ channel: channelName, messages: state.messagesByChannel[channelName] || [] });
});

app.post(`${API_PREFIX}/chat/messages`, (request, response) => {
  const payload = request.body || {};
  const channelName = payload.channel;
  const text = String(payload.text || "").trim();
  const translated = Boolean(payload.translated);

  if (!isValidChannel(channelName)) {
    response.status(400).json({ error: "Invalid channel" });
    return;
  }

  if (!text) {
    response.status(400).json({ error: "Message text is required" });
    return;
  }

  state.lastId += 1;
  const message = {
    id: state.lastId,
    user: "You",
    initials: "YU",
    color: "#0A84FF",
    time: nowTime(),
    text,
    reactions: ["✅ 1"],
    translated,
    ...(translated ? { lang: "🇪🇸" } : {})
  };

  appendMessage(channelName, message);
  state.channelUnread[channelName] = 0;
  saveState();

  response.status(201).json({ message, state: getPublicState() });
});

app.post(`${API_PREFIX}/chat/reactions`, (request, response) => {
  const payload = request.body || {};
  const channelName = payload.channel;
  const messageId = Number(payload.messageId);
  const emoji = String(payload.emoji || "").trim();

  if (!isValidChannel(channelName)) {
    response.status(400).json({ error: "Invalid channel" });
    return;
  }

  if (!messageId || !emoji) {
    response.status(400).json({ error: "messageId and emoji are required" });
    return;
  }

  const messages = state.messagesByChannel[channelName] || [];
  const target = messages.find((message) => Number(message.id) === messageId);

  if (!target) {
    response.status(404).json({ error: "Message not found" });
    return;
  }

  target.reactions = incrementReaction(target.reactions, emoji);
  saveState();

  response.json({ message: target, state: getPublicState() });
});

app.post(`${API_PREFIX}/chat/unread/clear`, (request, response) => {
  const payload = request.body || {};
  const channelName = payload.channel;

  if (!isValidChannel(channelName)) {
    response.status(400).json({ error: "Invalid channel" });
    return;
  }

  state.channelUnread[channelName] = 0;
  saveState();

  response.json({ state: getPublicState() });
});

app.post(`${API_PREFIX}/chat/simulate`, (request, response) => {
  const payload = request.body || {};
  const excludeChannel = payload.excludeChannel;

  const availableChannels = CHANNELS.map((channel) => channel.name).filter((channelName) => channelName !== excludeChannel);

  if (!availableChannels.length) {
    response.json({ state: getPublicState() });
    return;
  }

  const randomChannel = availableChannels[Math.floor(Math.random() * availableChannels.length)];
  const bank = INCOMING_MESSAGE_BANK[randomChannel] || INCOMING_MESSAGE_BANK["#general"];
  const randomText = bank[Math.floor(Math.random() * bank.length)];
  const randomAuthor = INCOMING_AUTHORS[Math.floor(Math.random() * INCOMING_AUTHORS.length)];

  state.lastId += 1;
  const incomingMessage = {
    id: state.lastId,
    user: randomAuthor.user,
    initials: randomAuthor.initials,
    color: randomAuthor.color,
    time: nowTime(),
    text: randomText,
    reactions: ["👀 1"],
    translated: false
  };

  appendMessage(randomChannel, incomingMessage);
  state.channelUnread[randomChannel] = (state.channelUnread[randomChannel] || 0) + 1;
  saveState();

  response.json({ channel: randomChannel, message: incomingMessage, state: getPublicState() });
});

app.post(`${API_PREFIX}/translator/adapt`, (request, response) => {
  const payload = request.body || {};
  const inputText = String(payload.inputText || "").trim();
  const sourceCulture = String(payload.sourceCulture || "American");
  const targetCulture = String(payload.targetCulture || "Bulgarian");
  const sourceLabel = normalizeCultureLabel(sourceCulture);
  const targetLabel = normalizeCultureLabel(targetCulture);

  if (!inputText) {
    response.status(400).json({ error: "inputText is required" });
    return;
  }

  if (
    inputText.toLowerCase() === "break a leg!" &&
    sourceLabel === "American" &&
    targetLabel === "Bulgarian"
  ) {
    response.json({
      result: {
        literal: "Счупи крак!",
        cultural: "Много успех!",
        note: "Bulgarians prefer direct well-wishing over idioms"
      }
    });
    return;
  }

  const resolvedTargetLabel = targetLabel || targetCulture;
  const literal = `${inputText} (${resolvedTargetLabel} literal)`;
  const cultural = CULTURE_ADAPTATIONS[resolvedTargetLabel] || inputText;
  const note = `Adjusted for ${resolvedTargetLabel} communication norms and tone.`;

  response.json({ result: { literal, cultural, note } });
});

app.post(`${API_PREFIX}/chat/reset`, (request, response) => {
  state = createInitialState();
  saveState();
  response.json({ state: getPublicState() });
});

app.use((request, response) => {
  response.status(404).json({ error: "Not found" });
});

app.listen(PORT, () => {
  console.log(`Spann backend running on http://localhost:${PORT}`);
  console.log(`Health endpoint: http://localhost:${PORT}${API_PREFIX}/health`);
});
