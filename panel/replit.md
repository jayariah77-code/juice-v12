# Juice v12 — WhatsApp Bot Control Panel

## Project Overview
A professional web dashboard to manage and monitor the **Juice v12** WhatsApp bot (owner: `254753204154`). The bot code lives on GitHub at https://github.com/jayariah77-code/juice-v12 and is deployed on Render. This Replit project hosts the control panel.

## Architecture
```
monorepo (pnpm workspaces)
├── artifacts/
│   ├── juice-panel/          # React + Vite frontend — the control panel UI
│   │   ├── src/pages/        # Dashboard, Settings, Commands, About
│   │   ├── src/components/   # Layout, UI components
│   │   └── src/hooks/        # API hooks
│   ├── api-server/           # Express backend (port 8080)
│   │   └── src/routes/
│   │       ├── bot.ts        # GET/PUT /api/bot/settings, /api/bot/status, /api/bot/commands
│   │       └── stats.ts      # GET /api/stats
│   └── mockup-sandbox/       # Canvas design server (internal)
└── lib/
    ├── db/                   # Drizzle ORM + PostgreSQL
    │   └── src/schema/
    │       └── botSettings.ts  # bot_settings, bot_stats tables
    ├── api-spec/             # OpenAPI 3.1 spec → codegen
    └── api-client-react/     # Auto-generated API hooks (orval)
```

## Key Details
- **Bot name**: Juice v12
- **Owner WhatsApp**: 254753204154
- **GitHub**: jayariah77-code/juice-v12
- **Bot repo**: https://github.com/jayariah77-code/juice-v12
- **Panel preview path**: `/` (port 22800)
- **API base path**: `/api` (port 8080)

## Panel Pages
1. **Dashboard** — Bot status, uptime, memory, traffic stats (messages/users/groups/commands)
2. **Configuration** — Toggle switches for all 12 bot features + text settings (name, prefix, owner, timezone, repo URL)
3. **Commands** — Full searchable command list organized by 8 categories (AI, Downloaders, Stickers, Group Tools, Games, Tools, Football, Owner)
4. **About Bot** — Bot info card with GitHub and WhatsApp links

## Bot Features Managed
welcome, antiLink, antiCall, autoRead, chatBot, autoViewStatus, autoLikeStatus, autoReact, autoReactEmoji, pmBlocker, antiBadword, antiTag, antiDelete

## Design System
- Dark mode: `#0a0a0a` background
- Accent: WhatsApp green `#25D366`
- Fonts: System sans-serif
- Animation: Framer Motion

## Environment Secrets
- `DATABASE_URL` — PostgreSQL connection (auto-provisioned)
- `SESSION_SECRET` — Express session secret
- GitHub integration: `conn_github_01KMXKX5DH0J7SN2SQTHTK4B1Q`
