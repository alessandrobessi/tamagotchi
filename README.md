```
████████╗ █████╗ ███╗   ███╗ █████╗  ██████╗  ██████╗ ████████╗ ██████╗██╗  ██╗██╗
╚══██╔══╝██╔══██╗████╗ ████║██╔══██╗██╔════╝ ██╔═══██╗╚══██╔══╝██╔════╝██║  ██║██║
   ██║   ███████║██╔████╔██║███████║██║  ███╗██║   ██║   ██║   ██║     ███████║██║
   ██║   ██╔══██║██║╚██╔╝██║██╔══██║██║   ██║██║   ██║   ██║   ██║     ██╔══██║██║
   ██║   ██║  ██║██║ ╚═╝ ██║██║  ██║╚██████╔╝╚██████╔╝   ██║   ╚██████╗██║  ██║██║
   ╚═╝   ╚═╝  ╚═╝╚═╝     ╚═╝╚═╝  ╚═╝ ╚═════╝  ╚═════╝    ╚═╝    ╚═════╝╚═╝  ╚═╝╚═╝
```

<p align="center">
  <strong>A shared virtual pet for the internet</strong><br>
  <em>One pet. Everyone cares for it. Together.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/STYLE-8--BIT-ff00ff?style=flat-square" alt="8-bit">
  <img src="https://img.shields.io/badge/VIBE-RETRO-00ffff?style=flat-square" alt="Retro">
  <img src="https://img.shields.io/badge/PET-SHARED-ffff00?style=flat-square" alt="Shared">
</p>

---

```
    ╔══════════════════════════════════════════════════════════════╗
    ║                                                              ║
    ║      ████                          "Take care of me...       ║
    ║    ██░░░░██                         but only once per        ║
    ║    ██░░░░██                         visit. I'm everyone's    ║
    ║      ████████                       responsibility."         ║
    ║      ██▓▓▓▓██                                                ║
    ║        ████                                    - The Pet     ║
    ║                                                              ║
    ╚══════════════════════════════════════════════════════════════╝
```

## The Philosophy

This isn't your typical Tamagotchi. This is **the world's Tamagotchi**.

Every visitor sees the same pet. Every action affects everyone. When you feed it, someone on the other side of the planet sees it get fed. When you neglect it... everyone watches it suffer.

**One action per visit.** That's all you get. Feed it? Play with it? Heal it? Choose wisely, then pass the torch to the next visitor. It takes a village to raise a virtual pet.

The pet evolves through six life stages, from egg to senior. It can live for days, weeks, maybe longer—if everyone does their part. But stats decay over time. Hunger grows. Happiness fades. Health deteriorates.

If the pet dies, anyone can give it new life. A fresh start. A new name. The cycle continues.

---

## Features

```
┌─────────────────────────────────────────────────────────────────┐
│  ► 8-BIT PIXEL ART SPRITES                                      │
│    Hand-crafted CSS pixel art for each evolution stage          │
│                                                                 │
│  ► SHARED GLOBAL STATE                                          │
│    One pet for all visitors, persisted in Vercel Edge Config    │
│                                                                 │
│  ► EVOLUTION SYSTEM                                             │
│    Egg → Baby → Child → Teen → Adult → Senior                   │
│                                                                 │
│  ► ONE ACTION PER VISIT                                         │
│    Strategic gameplay - choose your action wisely               │
│                                                                 │
│  ► REAL-TIME DECAY                                              │
│    Stats decrease over time - neglect has consequences          │
│                                                                 │
│  ► DEATH & REBIRTH                                              │
│    When health hits zero, anyone can start a new life           │
│                                                                 │
│  ► 80s RETRO AESTHETIC                                          │
│    CRT scanlines, neon colors, pixel fonts                      │
│                                                                 │
│  ► CROSS-TAB SYNC                                               │
│    Actions sync across browser tabs instantly                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

```
╔═══════════════════════════════════════════╗
║  FRONTEND     SvelteKit + Svelte 5        ║
║  LANGUAGE     TypeScript                  ║
║  PACKAGE MGR  pnpm                        ║
║  PERSISTENCE  Vercel Edge Config          ║
║  HOSTING      Vercel                       ║
║  FONT         Press Start 2P              ║
╚═══════════════════════════════════════════╝
```

---

## For Developers

### Prerequisites

- Node.js 18+
- pnpm
- Vercel account (for deployment)

### Local Setup

```sh
# Clone the repository
git clone https://github.com/alessandrobessi/tamagotchi.git
cd tamagotchi

# Install dependencies
pnpm install

# Start development server
pnpm dev
```

### Environment Variables

Create a `.env` file for local development (or configure in Vercel dashboard):

```sh
# Vercel Edge Config connection string
EDGE_CONFIG="https://edge-config.vercel.com/ecfg_xxx..."

# Edge Config ID (for write operations)
EDGE_CONFIG_ID="ecfg_xxxxxxxxxxxx"

# Vercel API token (needs Edge Config write permissions)
VERCEL_API_TOKEN="your_token_here"
```

### Build & Deploy

```sh
# Build for production
pnpm build

# Preview production build locally
pnpm preview

# Deploy to Vercel
vercel deploy
```

### Project Structure

```
src/
├── app.html              # HTML template
├── app.css               # Global styles
├── lib/
│   └── pet.ts            # Pet state management & Edge Config
└── routes/
    ├── +page.svelte      # Main UI & game logic
    └── api/
        ├── state/        # GET current pet state
        ├── feed/         # POST feed action
        ├── play/         # POST play action
        ├── heal/         # POST heal action
        └── rebirth/      # POST create new pet

static/
└── favicon.svg           # 8-bit pixel art favicon
```

---

## Stats & Decay

| Stat | Decay Rate | Death Threshold |
|------|------------|-----------------|
| Hunger | -5/hour | N/A |
| Happiness | -3/hour | N/A |
| Health | -2/hour* | 0 = Death |

*Health decay accelerates when hunger or happiness is critically low.

---

## Evolution Stages

```
TIME        STAGE       SPRITE
─────────────────────────────────
0-1 hr      Egg         🥚
1-6 hr      Baby        🐣
6-24 hr     Child       🐥
1-3 days    Teen        🐤
3-7 days    Adult       🐔
7+ days     Senior      👴🐔
```

---

<p align="center">
  <sub>
    Made with pixels and love<br>
    <code>PRESS START TO PLAY</code>
  </sub>
</p>

```
        ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
        ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
        ░░░░████░░░░████░░░░████░░░░████░░░░████░░░░░░░░
        ░░░░████░░░░████░░░░████░░░░████░░░░████░░░░░░░░
        ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
        ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
```
