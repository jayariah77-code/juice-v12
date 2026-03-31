import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { botStatsTable } from "@workspace/db/schema";

const router: IRouter = Router();

async function ensureStats() {
  const rows = await db.select().from(botStatsTable).limit(1);
  if (rows.length === 0) {
    await db.insert(botStatsTable).values({});
  }
  return db.select().from(botStatsTable).limit(1).then((r) => r[0]);
}

router.get("/", async (req, res) => {
  try {
    const stats = await ensureStats();
    const uptimeSeconds = Math.floor(process.uptime());
    const memUsage = process.memoryUsage();
    res.json({
      totalMessages: parseInt(stats.totalMessages) || 0,
      totalUsers: parseInt(stats.totalUsers) || 0,
      totalGroups: parseInt(stats.totalGroups) || 0,
      commandsUsed: parseInt(stats.commandsUsed) || 0,
      uptime: uptimeSeconds,
      memoryUsage: Math.round(memUsage.heapUsed / 1024 / 1024),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get stats");
    res.status(500).json({ error: "Failed to get stats" });
  }
});

export default router;
