# Project Docs

Context docs for the **Hidden Object Detective Game** (Phaser 3 + TypeScript + Vite, kiosk display).

Start here, then read the doc you need:

| Doc | What's in it |
|-----|--------------|
| [architecture.md](architecture.md) | How the game is structured: scenes, global state, data flow, gameplay loop. |
| [files.md](files.md) | Every source/asset file and what it does — the map of the codebase. |
| [tuning.md](tuning.md) | **Manual tuning guide** — where to change maps, item positions, player, timer, sizes, etc. |
| [plan.md](plan.md) | Current state, known issues, decisions made, and the roadmap to finish the game. |

> The authoritative quick-reference also lives in [`/CLAUDE.md`](../CLAUDE.md) at the repo root. These docs expand on it.

## The 30-second version

- 5-minute timer. Find **10 items** scattered across **outdoor tilemaps** + **indoor room photos**.
- Outdoor: walk (WASD / touch joystick), press the **magnifier** when near an item.
- Indoor: step on a Door/Water tile → opens a **room photo** you drag-to-pan and tap items in.
- One global evidence bar tracks all 10 items everywhere. Collect all 10 → win. Timer hits 0 → lose.

## Commands

```bash
npm run dev       # Vite dev server
npm run build     # production build
npm run preview   # preview production build
npx tsc --noEmit  # type-check (fast, no artifacts — run often)
```
