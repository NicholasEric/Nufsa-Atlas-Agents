# Manual Tuning Guide

Where to change things by hand. **Most content lives in `src/data/cases.json`; most feel/gameplay knobs live in the system files.** Dev server hot-reloads code, but `cases.json` and asset swaps need a server restart (`npm run dev`).

---

## 1. Item locations (where items hide)

**File: `src/data/cases.json` → `items[]`.** Each item's `location` block:

```jsonc
// Outdoor item — x/y are WORLD PIXELS on the tilemap (0,0 = top-left of map)
{ "id": "yukata", ..., "location": { "type": "map", "area": "japan-2", "x": 150, "y": 80 } }

// Indoor item — x/y are PIXEL COORDS on the room photo (0,0 = top-left of the image)
{ "id": "katana", ..., "location": { "type": "room", "area": "room-japan-1", "x": 1200, "y": 800 } }
```

- `area` for a **map** item = the case id (`japan-2`, `autumn`, …). For a **room** item = the room image key (`room-japan-1`, `room-autumn-1`, …).
- Map size in pixels = `tilewidth × columns` by `tileheight × rows` (japan-2 = 1024×768; autumn = 1024×768).
- Room photos are huge (3000–4000px wide). To find good x/y, open the image and read pixel coords, or temporarily nudge values and reload.
- ⚠️ Room item positions are currently **guessed**, not visually verified. A placement overlay is on the roadmap (plan.md).

## 2. Add / edit / remove an item

In `cases.json`:
1. Add an object to `items[]` with a unique `id`, `name`, `description`, `spriteKey` (e.g. `item_lantern`), `assetPath` (e.g. `items/japanese-lantern.png`), and a `location`.
2. Drop the PNG at `public/assets/<assetPath>`. Missing art → a colored placeholder circle is auto-generated (still collectable).
3. No code change needed — BootScene loads every item's `assetPath` automatically, and "win" counts `items.length`, so adding an item raises the target.

## 3. Add / configure a map

Three places must agree (see plan.md for the desert walkthrough):
1. **`cases.json` → `cases{}`** — add a case (`location`, `timeLimitSeconds`, `mapKey`, `ambientAudioKey`, `portalDestination`).
2. **`BootScene.ts` `preload()`** — `this.load.tilemapTiledJSON('<mapKey>', '...')` + `this.load.image('<tilesetImageKey>', '...')`.
3. **`GameScene.ts` `MAP_CONFIGS`** — add an entry: `tilemapKey`, `tilesets` (JSON tileset name → image key), `layerDepths` (which layers render + z-order), and `doors[]` (interaction zones).

> Tiled JSONs often reference external `.tsx` files via broken absolute paths. **Embed the tileset block inline** in the JSON (`firstgid`, `name`, `image`, `imagewidth/height`, `tilewidth/height`, `tilecount`, `columns`). `tilecount` must cover the highest tile id used. The `image` path is metadata only — runtime mapping is `addTilesetImage(name, imageKey)`.

## 4. Trigger zones (in the Tiled map JSON)

Draw tiles on these specially-named invisible layers (any non-empty tile = active):
- **`Collision`** — blocks player movement.
- **`HiddenMove`** — shows the travel button → sends player to `portalDestination`.
- **`Door1`, `Door2`, … / `Water1`, …** — shows the room-entry button → opens the room photo mapped in `MAP_CONFIGS.doors`.

To change *which room a door opens* or *its button label*, edit the matching `doors[]` entry in `MAP_CONFIGS` (`imageKey`, `label`). The `imageKey` is BOTH the loaded texture key AND the `location.area` used to match room items — they must be identical.

## 5. Player start position & feel

**File: `src/system/PlayerController.ts`** (and the `createPlayer()` call in `GameScene.ts`).

| Knob | Where | Current | Effect |
|------|-------|---------|--------|
| Start X / Y | `GameScene.createPlayer()` → `new PlayerController(this, { startX, startingY })` | 300, 300 | Spawn point (same for every map). |
| Move speed | same call, `speed` | 150 | Pixels/sec. |
| Sprite scale | `PlayerController` ctor `setScale(...)` | 0.3 | On-screen size. |
| Feet anchor | `VISIBLE_FEET_Y` | 120 | Y row treated as the feet; aligns triggers/collision. |
| Hitbox | `bodyW`, `bodyH` | 96, 96 | Collision body size. *(Currently being tuned — large value is intentional for now.)* |
| World clamp | `update()` `Phaser.Math.Clamp(..., 0, 1024 / 0, 768)` | viewport | Caps how far the player can walk. **Widen for maps bigger than 1024×768.** |

## 6. Detection / magnifier reach

**File: `src/system/ItemManager.ts` → `detectInArea()`.** `tileSize = 32` → `halfBox = 48`, so the magnifier finds items within **±48px** of the player center. Increase for a more forgiving search.

## 7. Timer

**File: `src/data/cases.json`** → each case's `timeLimitSeconds` (default 300 = 5 min). The countdown logic is in `GameScene.startTimer()` / `onTimerTick()`. Note: time **carries across maps** (travel) and **freezes** while a room is open.

## 8. Item display sizes

| Knob | File | Current |
|------|------|---------|
| Outdoor item size | `ItemManager.spawnItems` `targetSize` | 28 px |
| Outdoor item rotation jitter | `ItemManager.spawnItems` `setAngle(Between(-15,15))` | ±15° |
| Outdoor item opacity | `ItemManager.spawnItems` `setAlpha` | 0.9 |
| Room item size | `RoomScene.createRoomItemSprites` `targetSize` | 56 px |
| Drag-vs-tap threshold | `RoomScene.createRoomImage` | 3 px |

## 9. Popups, bar, modals

- **Evidence bar (shared):** `src/system/EvidenceBar.ts` — one component used by GameScene (via `UIManager`) and RoomScene. Tune slot size/pitch (`pitch`, `slotSize` in `build()`), panel height, the "?" placeholder, collected colors, and the tap-to-open description modal here. Editing this changes the bar **everywhere** at once.
- **FOUND popup & magnifier glow:** `src/system/UIManager.ts` (`createItemPopup` timings, glow).

## 10. Audio

**File: `src/system/AudioManager.ts`** + `BootScene.preload()` loads `ambient-japan`, `collect-sfx`, `detect-sfx`, `win-sfx`, `lose-sfx` from `public/assets/audio/`. Per-map ambient track = each case's `ambientAudioKey` in `cases.json`. All optional.

## 11. Resolution / kiosk

**File: `src/main.ts`** — `width/height` (1024×768), `Scale.FIT`, `activePointers`, double-tap fullscreen, context-menu/touch-zoom blocking.
