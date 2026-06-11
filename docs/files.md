# File Map

## Source (`src/`)

| File | Responsibility |
|------|----------------|
| `main.ts` | Phaser `GameConfig` (1024×768, FIT scale, arcade physics). Awaits `GameFont`, registers the 4 scenes, sets up kiosk behaviors (no context menu, no touch-zoom, double-tap fullscreen). |
| `types/game.types.ts` | All shared interfaces/enums: `ItemData`, `ItemLocation`, `CaseData`, `GameConfig`, `PlayerConfig`, `DetectionResult`, `SceneKeys`, `AssetKeys`. |
| `data/cases.json` | **The content source of truth.** Global `items[]` (all 10) + per-map `cases{}`. Edit item positions / add items here. |
| **scenes/** | |
| `BootScene.ts` | Asset loading (maps, tilesets, room photos, player frames, item PNGs, audio). Generates placeholder textures + player animations. Stores `gameConfig`, wipes `gameState`, starts GameScene. |
| `GameScene.ts` | Outdoor gameplay + the `MAP_CONFIGS` table. Map build, player, item detection, timer, portal travel, door triggers, win/lose. |
| `RoomScene.ts` | Drag-to-pan room photo view; per-item clickable sprites; own evidence bar; can win directly. |
| `ResultScene.ts` | Win/lose screen; auto-restart. |
| **system/** | |
| `PlayerController.ts` | WASD + touch joystick, idle/run anims, feet-anchored origin, physics body, facing direction, detection origin. |
| `ItemManager.ts` | Outdoor item spawn + `detectInArea` (box detection) + `collect` tween. (Also has unused hint/debug-cone helpers.) |
| `CaseFile.ts` | **Shared** evidence UI: a bottom-left "Case File" button (with `n/total` count) that opens a parchment book with two views — a **5×4 grid** of all item slots (icon once found, "?" until then), and a per-item **detail page** (name + description, big "?"→icon + FOUND stamp) reached by tapping a slot, with ◀/▶ to flip and "‹ All" back to the grid. Used by BOTH `UIManager` (GameScene) and `RoomScene`. `setCollected(id)` refreshes count + grid + open page. |
| `UIManager.ts` | Timer text, the SEARCH pill button (+ green proximity glow), FOUND popup, travel/room buttons, one-time button hints. Delegates the evidence UI to `CaseFile`. |
| `uiButtons.ts` | `createPillButton()` — shared builder for the gold-trimmed corner "pill" buttons (icon + label + optional count, shadow, hover/press, idle breathing glow). Used by the SEARCH button (`UIManager`) and the CASE FILE button (`CaseFile`) so they match. |
| `AudioManager.ts` | Singleton SFX + music. All optional. |

## Assets (`public/assets/`)

| Path | Notes |
|------|-------|
| `maps/japan/map-japan-2.json` | Primary outdoor map. **32×24 @ 32px = 1024×768.** Tileset: `tiles-japan`. Has `HiddenMove` + `Door1..4` trigger layers. |
| `maps/japan/balcony.jpg`, `living-room.jpg`, `shop.jpg` | Named room photos (`room-japan-balcony` / `-living-room` / `-shop`), opened by Door1 / Door2 / Door3. Door4 has no photo yet → opens the shared generated `room-placeholder`. |
| `maps/autumn/map-autumn.json` | Second outdoor map. **64×48 @ 16px = 1024×768.** Tilesets registered twice (`Autumn_Forest_Tiles` @ firstgid 1 **and** `_2` @ 2401, same image). Has `Water1` trigger. |
| `maps/autumn/room-1.png` | 3200×800 wide pond photo (`room-autumn-1`). |
| `maps/desert/map-desert.json` | Wired (`desert` case, 512×384). Tileset embedded manually (two: `desert-doodles` + `desert-tiles`). `Door1` → `room-desert-1`. |
| `maps/desert/room-1.jpg` | Desert room photo (`room-desert-1`). |
| `maps/castle/map-castle.json` | Wired (`castle` case, 992×704). Single `spritefusion` tileset → `tiles-castle`. No rooms. |
| `maps/dungeon/map-dungeon.json` | Wired (`dungeon` case, **320×208 — smaller than screen, zoomed up**). `spritefusion` → `tiles-dungeon`. `Door1` → placeholder room. |
| `maps/island/map-island.json` | Wired (`island` case, **1856×1024 — larger than screen, zoomed down**). `spritefusion` → `tiles-island`. `Door1` → placeholder room. |
| | _All maps now live in per-theme subfolders; the old top-level duplicate JSONs were deleted (2026-06-09)._ |
| `tiles/` | Tileset PNGs: `tiles-japan`, `Autumn_Forest_Tiles/_Objects`, `tiles-dessert` + `tiles-dessert-2` (desert), `tiles-castle`, `tiles-dungeon`, `tiles-island`. |
| `items/` | `japanese-<id>.png` item art. **Only 5 of 10 exist:** fan, hat, katana, origami, yukata. Missing: lantern, sake, daruma, bonsai, kitsune-mask (→ placeholder circles). |
| `player/` | `Idle(1).png`, `Idle(2).png`, `Run(1..4).png` — 112×128 each. |
| `fonts/font-2.otf` | Registered as `GameFont` via `@font-face` in `index.html`. |
| `audio/` | Ambient + SFX (optional; missing = silent). |

## Asset-key ↔ file cheat sheet (set in BootScene.ts `preload`)

| Phaser key | File |
|-----------|------|
| `japan-2-map` | `maps/japan/map-japan-2.json` |
| `tiles-japan` | `tiles/tiles-japan.png` |
| `autumn-map` | `maps/autumn/map-autumn.json` |
| `autumn-tiles` / `autumn-objects` | `tiles/Autumn_Forest_Tiles.png` / `_Objects.png` |
| `desert-map` / `desert-doodles` / `desert-tiles` | `maps/desert/map-desert.json` / `tiles/tiles-dessert.png` / `tiles/tiles-dessert-2.png` |
| `castle-map` / `tiles-castle` | `maps/castle/map-castle.json` / `tiles/tiles-castle.png` |
| `dungeon-map` / `tiles-dungeon` | `maps/dungeon/map-dungeon.json` / `tiles/tiles-dungeon.png` |
| `island-map` / `tiles-island` | `maps/island/map-island.json` / `tiles/tiles-island.png` |
| `room-japan-balcony` / `-living-room` / `-shop` | `maps/japan/balcony.jpg` / `living-room.jpg` / `shop.jpg` |
| `room-desert-1` | `maps/desert/room-1.jpg` |
| `room-placeholder` | generated in BootScene (`createRoomPlaceholderTexture`) — Japan Door4, dungeon & island doors until real photos exist |
| `room-autumn-1` | `maps/autumn/room-1.png` |
| `player-idle-1/2`, `player-run-1..4` | `player/Idle(n).png`, `player/Run(n).png` |
| `item_<id>` | `items/japanese-<id>.png` (from each item's `spriteKey`/`assetPath`) |
