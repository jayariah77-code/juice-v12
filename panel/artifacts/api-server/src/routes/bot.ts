import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { botSettingsTable, botStatsTable } from "@workspace/db/schema";
import { startQRLogin, startPairLogin, getConnectionStatus, getQRImage, disconnectWhatsApp } from "../lib/whatsapp";

const router: IRouter = Router();

const BOT_COMMANDS = {
  categories: [
    {
      name: "AI & Chat",
      icon: "🤖",
      commands: [
        { name: ".ai", description: "General AI (auto-selects best model)" },
        { name: ".gpt4o", description: "GPT-4o AI response" },
        { name: ".gemini", description: "Google Gemini AI" },
        { name: ".deepseek", description: "DeepSeek AI" },
        { name: ".mistral", description: "Mistral AI" },
        { name: ".grok", description: "Grok by xAI" },
        { name: ".vision", description: "AI image analysis (reply to image)" },
        { name: ".chatbot on/off", description: "Toggle auto-reply chatbot mode" },
        { name: ".imagine", description: "Generate AI image from prompt" },
        { name: ".deepimg", description: "AI image via Flux model" },
      ],
    },
    {
      name: "Downloaders",
      icon: "📥",
      commands: [
        { name: ".play", description: "YouTube audio (MP3)" },
        { name: ".ytv", description: "YouTube video (MP4)" },
        { name: ".tt", description: "TikTok video download" },
        { name: ".ig", description: "Instagram photo/reel" },
        { name: ".fb", description: "Facebook video" },
        { name: ".spotify", description: "Spotify track info" },
        { name: ".pinterest", description: "Pinterest image search" },
        { name: ".mediafire", description: "MediaFire file download" },
      ],
    },
    {
      name: "Stickers & Art",
      icon: "🖼️",
      commands: [
        { name: ".sticker / .s", description: "Convert media to sticker" },
        { name: ".take", description: "Re-pack a sticker" },
        { name: ".attp", description: "Animated text sticker" },
        { name: ".emojimix", description: "Mix two emojis" },
        { name: ".brat", description: "BRAT-style image" },
        { name: ".removebg", description: "Remove image background" },
        { name: ".neontext", description: "Neon glow text art" },
        { name: ".lavatext", description: "Lava/fire text art" },
      ],
    },
    {
      name: "Group Tools",
      icon: "👥",
      commands: [
        { name: ".add", description: "Add member to group" },
        { name: ".kick", description: "Remove member from group" },
        { name: ".promote", description: "Promote member to admin" },
        { name: ".demote", description: "Demote admin" },
        { name: ".warn", description: "Warn a member" },
        { name: ".antilink on/off", description: "Block invite links" },
        { name: ".welcome on/off", description: "Toggle welcome messages" },
        { name: ".everyone", description: "Tag all members" },
        { name: ".mute / .unmute", description: "Lock/unlock group chat" },
      ],
    },
    {
      name: "Games",
      icon: "🎮",
      commands: [
        { name: ".truth / .dare", description: "Truth or Dare" },
        { name: ".8ball", description: "Magic 8-Ball answer" },
        { name: ".ttt", description: "Tic-Tac-Toe game" },
        { name: ".trivia", description: "Random trivia question" },
        { name: ".hangman", description: "Play Hangman" },
        { name: ".rps", description: "Rock Paper Scissors" },
        { name: ".coinflip", description: "Flip a coin" },
        { name: ".roll", description: "Roll a dice" },
      ],
    },
    {
      name: "Tools & Search",
      icon: "🛠️",
      commands: [
        { name: ".tr", description: "Translate text to any language" },
        { name: ".weather", description: "Weather report for any city" },
        { name: ".wikipedia", description: "Wikipedia summary" },
        { name: ".google", description: "Google search" },
        { name: ".qr", description: "Generate QR code" },
        { name: ".screenshot", description: "Website screenshot" },
        { name: ".tts", description: "Text to speech audio" },
        { name: ".calc", description: "Calculator" },
      ],
    },
    {
      name: "Football / Sports",
      icon: "⚽",
      commands: [
        { name: ".epl", description: "EPL standings" },
        { name: ".laliga", description: "La Liga standings" },
        { name: ".ucl", description: "Champions League standings" },
        { name: ".livescore", description: "Live football scores" },
        { name: ".predict", description: "Today's football predictions" },
        { name: ".epltopscorers", description: "EPL top goal scorers" },
        { name: ".footnews", description: "Latest football news" },
      ],
    },
    {
      name: "Owner Tools",
      icon: "🔐",
      commands: [
        { name: ".setprefix", description: "Change bot command prefix" },
        { name: ".broadcast", description: "Broadcast message to all chats" },
        { name: ".block / .unblock", description: "Block or unblock a user" },
        { name: ".setbio", description: "Update bot WhatsApp bio" },
        { name: ".restart", description: "Restart the bot" },
        { name: ".ping", description: "Bot speed and uptime" },
        { name: ".botinfo", description: "Bot information card" },
        { name: ".repo", description: "Show GitHub repository link" },
      ],
    },
  ],
};

async function ensureSettings() {
  const rows = await db.select().from(botSettingsTable).limit(1);
  if (rows.length === 0) {
    await db.insert(botSettingsTable).values({});
  }
  return db.select().from(botSettingsTable).limit(1).then((r) => r[0]);
}

async function ensureStats() {
  const rows = await db.select().from(botStatsTable).limit(1);
  if (rows.length === 0) {
    await db.insert(botStatsTable).values({});
  }
  return db.select().from(botStatsTable).limit(1).then((r) => r[0]);
}

router.get("/settings", async (req, res) => {
  try {
    const settings = await ensureSettings();
    res.json({
      botName: settings.botName,
      ownerNumber: settings.ownerNumber,
      botPrefix: settings.botPrefix,
      welcome: settings.welcome,
      antiLink: settings.antiLink,
      antiCall: settings.antiCall,
      autoRead: settings.autoRead,
      chatBot: settings.chatBot,
      autoViewStatus: settings.autoViewStatus,
      autoLikeStatus: settings.autoLikeStatus,
      autoReact: settings.autoReact,
      autoReactEmoji: settings.autoReactEmoji,
      pmBlocker: settings.pmBlocker,
      antiBadword: settings.antiBadword,
      antiTag: settings.antiTag,
      antiDelete: settings.antiDelete,
      timezone: settings.timezone,
      repoUrl: settings.repoUrl,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get settings");
    res.status(500).json({ error: "Failed to get settings" });
  }
});

router.put("/settings", async (req, res) => {
  try {
    const settings = await ensureSettings();
    const body = req.body;
    const { eq } = await import("drizzle-orm");
    await db
      .update(botSettingsTable)
      .set({
        botName: body.botName ?? settings.botName,
        ownerNumber: body.ownerNumber ?? settings.ownerNumber,
        botPrefix: body.botPrefix ?? settings.botPrefix,
        welcome: body.welcome ?? settings.welcome,
        antiLink: body.antiLink ?? settings.antiLink,
        antiCall: body.antiCall ?? settings.antiCall,
        autoRead: body.autoRead ?? settings.autoRead,
        chatBot: body.chatBot ?? settings.chatBot,
        autoViewStatus: body.autoViewStatus ?? settings.autoViewStatus,
        autoLikeStatus: body.autoLikeStatus ?? settings.autoLikeStatus,
        autoReact: body.autoReact ?? settings.autoReact,
        autoReactEmoji: body.autoReactEmoji ?? settings.autoReactEmoji,
        pmBlocker: body.pmBlocker ?? settings.pmBlocker,
        antiBadword: body.antiBadword ?? settings.antiBadword,
        antiTag: body.antiTag ?? settings.antiTag,
        antiDelete: body.antiDelete ?? settings.antiDelete,
        timezone: body.timezone ?? settings.timezone,
        repoUrl: body.repoUrl ?? settings.repoUrl,
      })
      .where(eq(botSettingsTable.id, settings.id));
    const updated = await ensureSettings();
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update settings");
    res.status(500).json({ error: "Failed to update settings" });
  }
});

router.get("/status", async (_req, res) => {
  const uptimeSeconds = Math.floor(process.uptime());
  const wa = getConnectionStatus();
  res.json({
    connected: wa.connected,
    phone: wa.phone ?? "Not connected",
    uptime: uptimeSeconds,
    version: "2.0.0",
    platform: "Juice v12 Panel",
    hasQR: wa.hasQR,
    pairingCode: wa.pairingCode,
    pairingCodeExpiry: wa.pairingCodeExpiry,
    mode: wa.mode,
  });
});

// Start QR login — returns the base64 QR image immediately
router.post("/qr", async (req, res) => {
  try {
    req.log.info("Starting QR login");
    const qrImage = await startQRLogin();
    if (qrImage === "already-linked") {
      res.json({ alreadyLinked: true });
    } else {
      res.json({ qrImage });
    }
  } catch (err: any) {
    req.log.error({ err }, "QR login failed");
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

// Poll for fresh QR image (refreshes every ~20s)
router.get("/qr-image", (_req, res) => {
  const img = getQRImage();
  if (img) {
    res.json({ qrImage: img });
  } else {
    res.status(204).end();
  }
});

// Pairing-code login (phone number method)
router.post("/pair", async (req, res) => {
  try {
    const { phone } = req.body as { phone?: string };
    const number = (phone ?? "254753204154").replace(/[^0-9]/g, "");
    if (!number) {
      res.status(400).json({ error: "Phone number required" });
      return;
    }
    req.log.info({ number }, "Starting pairing code login");
    const code = await startPairLogin(number);
    res.json({ code, phone: number });
  } catch (err: any) {
    req.log.error({ err }, "Pairing code failed");
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

router.post("/disconnect", async (_req, res) => {
  try {
    await disconnectWhatsApp();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

router.get("/commands", (_req, res) => {
  res.json(BOT_COMMANDS);
});

export default router;
