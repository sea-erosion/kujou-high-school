# 久条高校 — Kujou High School
### 2D Pixel Art Action Game — Next.js + TypeScript + Phaser 3

Play as a delinquent fighting through school with a black umbrella.

## Controls
| Key | Action |
|-----|--------|
| ←→ / A D | Move |
| SPACE / ↑ | Jump (double jump) |
| SHIFT | Dash |
| ↓ + SHIFT | Roll (i-frames) |
| Z | Attack (↑/↓ to aim) |
| X (hold) | Guard (open umbrella) |
| C | Finisher |
| F1 | Debug hitboxes |

## Install & Run
```bash
npm install
npm run dev       # localhost:3000
npm run build     # production
```

## GitHub Pages Deploy
```bash
# 1. Push to GitHub repo named kujou-high-school
# 2. Settings → Pages → Source: GitHub Actions
# 3. Push triggers auto-deploy

# Manual static build:
GITHUB_PAGES=true npm run build
# ./out/ = deployable static files
```

## Structure
```
lib/game/
  game.ts                  # Phaser config
  assets/SpriteGenerator.ts    # All pixel art via Canvas API
  systems/AnimationManager.ts  # Phaser animation registry
  systems/StatusEffects.ts     # 9 status effects
  entities/Player.ts           # Full player with umbrella system
  entities/Enemy.ts            # Thug + GangBoss AI
  scenes/TitleScene.ts         # Title screen
  scenes/GameScene.ts          # Main gameplay
  scenes/UIScene.ts            # HUD overlay
```
