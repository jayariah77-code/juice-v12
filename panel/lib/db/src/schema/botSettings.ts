import { pgTable, text, boolean, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const botSettingsTable = pgTable("bot_settings", {
  id: serial("id").primaryKey(),
  botName: text("bot_name").notNull().default("Juice v12"),
  ownerNumber: text("owner_number").notNull().default("254753204154"),
  botPrefix: text("bot_prefix").notNull().default("."),
  welcome: boolean("welcome").notNull().default(false),
  antiLink: boolean("anti_link").notNull().default(false),
  antiCall: boolean("anti_call").notNull().default(false),
  autoRead: boolean("auto_read").notNull().default(false),
  chatBot: boolean("chat_bot").notNull().default(false),
  autoViewStatus: boolean("auto_view_status").notNull().default(false),
  autoLikeStatus: boolean("auto_like_status").notNull().default(false),
  autoReact: boolean("auto_react").notNull().default(false),
  autoReactEmoji: text("auto_react_emoji").notNull().default("👍"),
  pmBlocker: boolean("pm_blocker").notNull().default(false),
  antiBadword: boolean("anti_badword").notNull().default(false),
  antiTag: boolean("anti_tag").notNull().default(false),
  antiDelete: boolean("anti_delete").notNull().default(false),
  timezone: text("timezone").notNull().default("Africa/Nairobi"),
  repoUrl: text("repo_url").notNull().default("https://github.com/jayariah77-code/juice-v12"),
});

export const insertBotSettingsSchema = createInsertSchema(botSettingsTable).omit({ id: true });
export type InsertBotSettings = z.infer<typeof insertBotSettingsSchema>;
export type BotSettings = typeof botSettingsTable.$inferSelect;

export const botStatsTable = pgTable("bot_stats", {
  id: serial("id").primaryKey(),
  totalMessages: text("total_messages").notNull().default("0"),
  totalUsers: text("total_users").notNull().default("0"),
  totalGroups: text("total_groups").notNull().default("0"),
  commandsUsed: text("commands_used").notNull().default("0"),
});
