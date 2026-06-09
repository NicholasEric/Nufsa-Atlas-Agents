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

Draw tiles on these specially-named invisible layers (any non-empty tile = active; names match **case-insensitively**, so `collision` or `Collision` both work):
- **`Collision`** — blocks player movement.
- **`<Destination>Portal`** tile layers — travel triggers (see "Portals" below). `HiddenMove` is **no longer used**.
- **`Door1`, `Door2`, … / `Water1`, …** — shows the room-entry button → opens the room photo mapped in `MAP_CONFIGS.doors`.

### Portals (auto-discovered by name + spawn-back)
Portals are **tile layers named `<Destination>Portal`** — e.g. `DesertPortal`, `AutumnPortal`, `JapanPortal`. The engine auto-discovers them: the prefix is the destination case id (`Japan` → `japan-2`, others identity), so **no code/config is needed** — just paint the layer in Tiled.
- A map can have any number of portal layers → it branches to multiple maps. (Japan has Desert/Autumn/Island/Castle portals.)
- Stepping onto a portal's tiles shows the travel button; pressing it travels there.
- **Spawn-back:** on arrival you appear on the destination map's portal that leads *back* to where you came from. So make portals bidirectional — if `A` has a `BPortal`, give `B` an `APortal` (otherwise the arrival spawn falls back to ~(300,300)). The spawn point is the **center of that portal's painted tiles**.
- An explicit `MAP_CONFIGS.portals` array (`{ layerName, destination, label? }`) still overrides discovery if you ever need custom names/labels.

To change *which room a door opens* or *its button label*, edit the matching `doors[]` entry in `MAP_CONFIGS` (`imageKey`, `label`). The `imageKey` is BOTH the loaded texture key AND the `location.area` used to match room items — they must be identical.

## 5. Player start position & feel

**File: `src/system/PlayerController.ts`** (and the `createPlayer()` call in `GameScene.ts`).

| Knob | Where | Current | Effect |
|------|-------|---------|--------|
| Start X / Y | `GameScene.createPlayer()` | `min(300, mapW/2)`, `min(300, mapH/2)` | Spawn point, clamped so it's never outside small maps (e.g. dungeon). Add a per-map override here if a spawn lands on a wall. |
| Move speed | `new PlayerController(this, { speed })` | 150 | Pixels/sec. |
| Sprite scale | `GameScene.createPlayer()` `playerScale = 0.3 / fitZoom` | ~34px on screen | Scaled by `1/zoom` so the player is a consistent on-screen size on every map (matches japan). Change the `0.3` base to resize the player globally; `PlayerController` defaults to 0.3 if no scale is passed. |
| Feet anchor | `VISIBLE_FEET_Y` | 120 | Y row treated as the feet; aligns triggers/collision. |
| Hitbox | `bodyW`, `bodyH` | 96, 96 | Collision body size. *(Owner is tuning — large value intentional.)* |
| World clamp | auto from map size | `mapWidth/mapHeight` | `GameScene.createPlayer()` passes the tilemap's pixel size into `PlayerController`, which clamps the player to it. No hardcoded value to edit. |

### Camera (per map) — zoom-to-fit + UI camera
`GameScene.setupCameras()` (called at the end of `create()`) makes every map present at a uniform 1024×768:
- The **world camera** (`cameras.main`) zooms each map to fit the screen — `zoom = min(viewW/mapW, viewH/mapH)` — centered and static. Small maps (dungeon, desert) fill the view; large maps (island) shrink to fit. Maps that aren't 4:3 get thin letterbox bars (the camera background shows through).
- A second **UI camera** (`this.uiCamera`) renders the HUD at zoom 1 so the timer / evidence bar / magnifier never scale. Each camera `ignore()`s the other's objects (world = tilemap layers + player + items; UI = `UIManager.getCameraObjects()` + the player's joystick).
- **Gotcha:** any *new* display object created in GameScene must land on the right camera or it double-draws. World objects are collected in `setupCameras()`; transient HUD (popups, game-over, travel/room buttons) must be nested in `UIManager`'s `uiContainer` (already done) so ignoring that container covers them.
- To switch from "fit" (letterbox) to "fill" (cover, crops edges), change `Math.min(...)` to `Math.max(...)` in `setupCameras()`.

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

## 9. Popups, evidence book, modals

- **Case File (shared evidence UI):** `src/system/CaseFile.ts` — one component used by GameScene (via `UIManager`) and RoomScene. Tune the bottom-left button (`createButton`: size/position/colors), the parchment book (`createBook`: page size `pw/ph`, colors `0xf2e6c8`, fonts), the per-page layout (`updatePage`: icon fit size, "?" glyph, FOUND stamp), and open/flip animations (`open`, `flip`). Editing this changes the evidence UI **everywhere** at once.
- **FOUND popup & magnifier glow:** `src/system/UIManager.ts` (`createItemPopup` timings, glow).

## 10. Audio

**File: `src/system/AudioManager.ts`** + `BootScene.preload()` loads `ambient-japan`, `collect-sfx`, `detect-sfx`, `win-sfx`, `lose-sfx` from `public/assets/audio/`. Per-map ambient track = each case's `ambientAudioKey` in `cases.json`. All optional.

## 11. Resolution / kiosk

**File: `src/main.ts`** — `width/height` (1024×768), `Scale.FIT`, `activePointers`, double-tap fullscreen, context-menu/touch-zoom blocking.

## 12. Editing maps in Tiled

The maps are [Tiled](https://www.mapeditor.org) JSON. Edit them when you need to add/fix collision, portals, doors, or change a map's size/shape.

**One-time setup per map — fix the tileset image path so Tiled can render it.** The embedded tilesets point `image` at a `…/Downloads/…png` path (metadata Phaser ignores, but **Tiled needs it to display tiles**). Every map now lives one level deep (`maps/<theme>/map-*.json`), so repoint `image` to `"../../tiles/<the-png>"` (e.g. `"../../tiles/tiles-castle.png"`). Then `File → Open` the `.json` in Tiled.

**Special layer names the game looks for** (case-insensitive):
- `Collision` — paint any tile where the player should be blocked (any non-empty tile blocks). Invisible at runtime.
- `HiddenMove` — paint tiles for the travel-portal trigger zone.
- `Door1`, `Door2`, … (or `Water1`) — paint tiles at a doorway; then map it to a room image in `GameScene.MAP_CONFIGS.doors`.
- All **visible** layers must be listed in that map's `MAP_CONFIGS.layerDepths`, or they won't render.

**Common tasks:**
- *Add/fix collision:* New Tile Layer named `Collision` → pick a tile → paint over walls. (Set the layer's opacity to ~50% while editing; the game hides it.)
- *Resize a map:* `Map → Resize Map` (set width/height in tiles, choose an anchor). To make a map native 1024×768, use the grid for its tile size: 32px→32×24, 16px→64×48, 64px→16×12.
- *Keep it JSON:* `File → Save` (don't switch to `.tmx`). Keep tilesets **embedded** where possible.
- *External-tileset safety net:* Tiled tends to re-add the original tileset as an external `…/Downloads/*.tsx` reference when you paint with it. Phaser can't load those, so `GameScene.stripExternalTilesets()` automatically drops them on load (you'll see a console warning). **Caveat:** any tiles painted from that external tileset won't render — so paint **visible** tiles only from the embedded tilesets. Invisible trigger tiles (portals, collision, doors) are unaffected since they never render.
- Restart the dev server after editing (maps don't hot-reload).

**Should you standardize all maps in Tiled?** Not required — `setupCameras()` already presents every map at 1024×768 with a consistent ~1-tile player. Editing in Tiled is worth it when you (a) need to place/fix collision/portals/doors anyway, or (b) want to remove the letterbox bars / upscale softness on a specific map by rebuilding it natively to 4:3 / a standard size. Making *all* maps one tile size + 1024×768 would remove zoom entirely (cleanest look) but is real redraw work — do it selectively for the maps that bother you most.
