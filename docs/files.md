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
| `EvidenceBar.ts` | **Shared** bottom evidence bar: icon slots (collected = item art + ✓; uncollected = dark "?"), tap-a-slot → self-contained description modal. Used by BOTH `UIManager` (GameScene) and `RoomScene` so they can't drift. `setCollected(id)` ticks a slot. |
| `UIManager.ts` | Timer text, magnifier button, FOUND popup, travel/room buttons. Delegates the evidence bar to `EvidenceBar`. |
| `AudioManager.ts` | Singleton SFX + music. All optional. |

## Assets (`public/assets/`)

| Path | Notes |
|------|-------|
| `maps/japan/map-japan-2.json` | Primary outdoor map. **32×24 @ 32px = 1024×768.** Tileset: `tiles-japan`. Has `HiddenMove` + `Door1..4` trigger layers. |
| `maps/japan/balcony.jpg`, `living-room.jpg`, `shop.jpg` | Named room photos (`room-japan-balcony` / `-living-room` / `-shop`), opened by Door1 / Door2 / Door3. Door4 has no photo yet → opens a generated `room-japan-placeholder`. |
| `maps/autumn/map-autumn.json` | Second outdoor map. **64×48 @ 16px = 1024×768.** Tilesets registered twice (`Autumn_Forest_Tiles` @ firstgid 1 **and** `_2` @ 2401, same image). Has `Water1` trigger. |
| `maps/autumn/room-1.png` | 3200×800 wide pond photo (`room-autumn-1`). |
| `maps/desert/map-desert.json` | **Unwired** third map (edited but not in code/cases). |
| `maps/desert/room-1.jpg` | Desert room photo (for later). |
| `maps/map-autumn.json`, `maps/map-japan*.json` | **Legacy top-level duplicates — ignore.** The real ones live under per-theme folders. |
| `tiles/` | Tileset PNGs: `tiles-japan.png`, `Autumn_Forest_Tiles.png`, `Autumn_Forest_Objects.png`, `tiles-dessert-2.png` (desert, unused). |
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
| `room-japan-balcony` / `-living-room` / `-shop` | `maps/japan/balcony.jpg` / `living-room.jpg` / `shop.jpg` |
| `room-japan-placeholder` | generated in BootScene (`createRoomPlaceholderTexture`) — Door4 until its photo exists |
| `room-autumn-1` | `maps/autumn/room-1.png` |
| `player-idle-1/2`, `player-run-1..4` | `player/Idle(n).png`, `player/Run(n).png` |
| `item_<id>` | `items/japanese-<id>.png` (from each item's `spriteKey`/`assetPath`) |
