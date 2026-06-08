# Architecture

## Tech stack
- **Phaser 3** (game engine), **TypeScript**, **Vite** (dev/build).
- Renders into `#app` at a fixed **1024×768** logical resolution, scaled with `Phaser.Scale.FIT` + center (so it letterboxes on any kiosk screen). See `src/main.ts`.
- **Arcade physics**, top-down, zero gravity.
- Custom font `GameFont` (`public/assets/fonts/font-2.otf`) is awaited before the game boots so first-frame text uses it.

## Scenes (the four states)

```
BootScene ──> GameScene ⇄ RoomScene
                  │
                  └──> ResultScene ──(auto-restart)──> BootScene
```

| Scene | Role |
|-------|------|
| **BootScene** | Loads every asset (maps, tilesets, room photos, player frames, item PNGs, audio), generates placeholder textures for anything missing, registers player animations, stores config in the registry, then starts GameScene. |
| **GameScene** | The outdoor gameplay. Builds the tilemap for the current case, spawns the player + outdoor items, runs the timer, handles magnifier detection, portal travel, and door triggers. |
| **RoomScene** | An indoor photo opened *on top of* a paused GameScene. Drag-to-pan a large image; tap items to collect. Has its own read-only evidence bar. |
| **ResultScene** | Win/lose screen, shows items found + time, auto-restarts the game. |

## Global state lives in the Phaser registry

Two registry keys are the backbone of the whole game:

- **`gameConfig`** — the full parsed `src/data/cases.json` (`items[]` + `cases{}`). Set once in BootScene, read everywhere.
- **`gameState`** — `{ timeRemaining: number, collectedIds: string[] }`. This is the *single source of truth for progress*. It survives scene restarts (travel) and pauses (room view), and is **wiped on every fresh boot** so each session starts clean.

Because progress is global, the same evidence bar appears identically in GameScene and RoomScene, and an item collected indoors immediately reflects outdoors.

## Scene transitions (important nuances)

- **Map → Map (portal travel):** `scene.restart({ caseId })`. Full reset of GameScene; progress preserved because it's in the registry. Triggered by the travel button while standing on a `HiddenMove` tile.
- **Map → Room:** `scene.pause()` on GameScene + `scene.launch(RoomScene, …)`. Phaser **auto-pauses the paused scene's time events**, so the countdown timer freezes while you're in a room. RoomScene closes via `scene.stop()` + `scene.resume(GameScene)`.
- **GameScene resume hook:** on `'resume'`, GameScene re-reads `collectedIds`, ticks any newly-collected bar entries, and ends the game if the room collected the final item.
- **Winning from inside a room:** RoomScene can end the game directly (`scene.stop(Game)` + start ResultScene) if its collection completes all 10.

## The data model: `cases.json`

One global `items[]` array + a `cases{}` map. Each item declares where it lives:

```jsonc
"location": { "type": "map",  "area": "<caseId>",      "x": 150, "y": 80 }   // world pixels on a tilemap
"location": { "type": "room", "area": "<roomImageKey>", "x": 1200, "y": 800 } // pixel coords on a room photo
```

- `type: "map"` → `area` is a case id (`japan-2`, `autumn`). x/y are world pixels.
- `type: "room"` → `area` is a room image key (`room-japan-1`). x/y are pixels on that image.
- Win = `collectedIds.length === items.length`.

Each case:

```jsonc
"japan-2": {
  "location": "Kyoto District",      // display name
  "timeLimitSeconds": 300,
  "mapKey": "japan-2-map",           // matches the tilemap key loaded in BootScene
  "ambientAudioKey": "ambient-japan",
  "portalDestination": "autumn"      // where the travel button sends you
}
```

## Two parallel item-collection paths

**Outdoor (map items)** — magnifier button → `ItemManager.detectInArea` (a box ±48px around the player) → closest uncollected item → `collect()` (scale+fade tween) → `recordCollected(id)` into the registry → popup → tick bar → global win check.

**Indoor (room items)** — `RoomScene` renders a sprite per uncollected room item at its image-pixel coords; sprites track the dragged image. Tap (drag-vs-click separated by a 3px move threshold) → fade + persist → static popup → tick local bar → win check.

## How a map is wired (`MAP_CONFIGS` in GameScene.ts)

A per-case static table that ties everything together for one outdoor map:

```ts
'japan-2': {
  tilemapKey: 'japan-2-map',                                  // loaded in BootScene
  tilesets: [{ name: 'tiles-japan', imageKey: 'tiles-japan' }],// JSON tileset name → loaded image key
  layerDepths: [ { name: 'Ground', depth: -2 }, ... ],         // which Tiled layers to render + z-order
  doors: [ { layerName: 'Door1', imageKey: 'room-japan-1', label: 'Enter Room 1' }, ... ],
}
```

Special invisible Tiled layers carry only trigger data (never rendered):
- **`Collision`** → `setCollisionByExclusion([-1, 0])`, blocks player movement.
- **`HiddenMove`** → parsed into a `Set<"col,row">`; stepping on one shows the travel button.
- **`Door1..N` / `Water1..N`** → parsed into a `Map<"col,row", {imageKey,label}>`; stepping on one shows the room-entry button.

Each frame, `update()` converts the player's world position to a tile coord and edge-triggers the relevant UI button.

## Player sprite quirks (don't "fix" these by accident)
- Source PNGs are 112×128 with transparent padding below the visible feet. Origin is set to `(0.5, VISIBLE_FEET_Y/128)` so `sprite.x/y` equals the **visible feet**, keeping triggers/collisions aligned with what you see.
- **Side-view frames only** — no up/down art. Up/down movement keeps the last horizontal facing.
- `update()` currently clamps the player to `0–1024 × 0–768` (the viewport). Both existing maps are exactly viewport-sized so there's no camera scrolling. **A larger map (e.g. desert) would need this clamp widened and a camera follow added.**

## Audio
`AudioManager` is a singleton (SFX + ambient music). All audio is optional — missing files just no-op.
