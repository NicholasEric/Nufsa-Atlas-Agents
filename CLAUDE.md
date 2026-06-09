# Hidden Object Detective Game

Top-down hidden-object game built with Phaser 3 + TypeScript for a kiosk display. Player has 5 minutes to find 10 items scattered across **two outdoor maps** (Kyoto District and Autumn Forest) and **5 indoor room photos** opened from interaction zones.

## Quick commands
```bash
npm run dev      # Vite dev server
npm run build    # production build
npm run preview  # preview production build
npx tsc --noEmit # type-check (use this often, no build artifacts)
```

## Project layout
```
src/
├── main.ts                    # Phaser config; awaits GameFont, registers all 4 scenes
├── types/game.types.ts        # ItemData, ItemLocation, CaseData, GameConfig, SceneKeys
├── scenes/
│   ├── BootScene.ts           # asset loading; placeholder texture generation
│   ├── GameScene.ts           # outdoor gameplay; map switching; door triggers
│   ├── RoomScene.ts           # scrollable room photo view; click-to-collect items
│   └── ResultScene.ts         # win/lose screen, auto-restart
├── system/
│   ├── PlayerController.ts    # WASD + touch joystick; idle/run anims; feet-anchored origin
│   ├── ItemManager.ts         # outdoor item spawn + 3x3 tile detection
│   ├── UIManager.ts           # timer, evidence bar, magnifier, modals, popups, travel/room buttons
│   └── AudioManager.ts        # SFX + music (singleton)
└── data/cases.json            # global items[] + per-map cases{}

public/assets/
├── maps/                      # one per-theme subfolder per map (no top-level map JSONs)
│   ├── japan/                 # map-japan-2.json + balcony/living-room/shop room photos
│   ├── autumn/                # map-autumn.json + room-1.png pond photo
│   ├── desert/                # map-desert.json + room-1.jpg
│   ├── castle/                # map-castle.json (no rooms)
│   ├── dungeon/               # map-dungeon.json (Door1 → placeholder room)
│   └── island/                # map-island.json (Door1 → placeholder room)
├── tiles/                     # tileset PNGs (Autumn_Forest_Tiles, _Objects, tiles-japan)
├── items/                     # japanese-<id>.png item art
├── player/                    # Idle(1).png, Idle(2).png, Run(1..4).png — 112x128 each
├── fonts/font-2.otf           # GameFont
└── audio/                     # SFX + ambient (optional)
```

## Data model: `cases.json`
Top-level shape (the single source of truth — edit positions / add items here):
```json
{
  "items": [
    { "id": "yukata", "name": "...", "description": "...",
      "spriteKey": "item_yukata", "assetPath": "items/japanese-yukata.png",
      "location": { "type": "map", "area": "japan-2", "x": 150, "y": 80 } },
    { "id": "katana", ...,
      "location": { "type": "room", "area": "room-japan-1", "x": 1200, "y": 800 } }
  ],
  "cases": {
    "japan-2": { "location": "Kyoto District", "timeLimitSeconds": 300,
                 "mapKey": "japan-2-map", "portalDestination": "autumn",
                 "ambientAudioKey": "ambient-japan" },
    "autumn":  { ..., "portalDestination": "japan-2" }
  }
}
```
- `location.type`: `"map"` (outdoor — x/y are world pixels) or `"room"` (x/y are pixel coords on the room image).
- `location.area`: case id for map items, room image key (e.g. `"room-japan-1"`) for room items.
- One global `collectedIds` set in `gameState` registry tracks progress across everything.
- Win = all `cfg.items.length` items collected.

## Key architecture conventions

### Registry keys (global game state)
- `gameConfig`: full `cases.json` (items + cases)
- `gameState`: `{ timeRemaining: number, collectedIds: string[] }` — persists across scene restarts (travel) and pauses (room view). Wiped on every fresh boot.

### Scene transitions
- **Map switching** (HiddenMove portal): `scene.restart({ caseId })` — full scene reset, state preserved via registry.
- **Room view** (Door/Water layer): `scene.pause()` + `scene.launch(RoomScene, { caseId, roomImageKey })`. Phaser auto-pauses time events for paused scenes → timer freezes.
- **GameScene resume hook**: listens for `'resume'` event; refreshes evidence bar and triggers `endGame(true)` if RoomScene collected the final item.

### MAP_CONFIGS table (`GameScene.ts`)
Per-case static table mapping caseId → tilemap key, tilesets to register, layer→depth assignments, AND `doors[]` (interaction zones):
```ts
'japan-2': {
  tilemapKey: 'japan-2-map',
  tilesets: [{ name: 'tiles-japan', imageKey: 'tiles-japan' }],
  layerDepths: [...],
  doors: [
    { layerName: 'Door1', imageKey: 'room-japan-1', label: 'Enter Room 1' },
    ...
  ],
}
```
To add a new map: add an entry here, load the tilemap + tileset PNG in BootScene, add a case in `cases.json`.

### Trigger zones (HiddenMove + Door layers)
- Each map JSON has invisible Tiled layers carrying tile data only. `parseHiddenMoveTiles()` and `parseDoorTiles()` build `Set<"col,row">` / `Map<"col,row", config>` for fast per-frame lookup.
- `update()` calls `worldToTileXY(playerPos.x, playerPos.y)` and edge-triggers UI buttons via `inPortal` / `activeDoorKey` flags.
- The trigger layers are also created with `setVisible(false)` so the data tiles don't render.

## Player sprite quirks (important!)
- Source PNGs are 112x128 with **15px transparent padding** below the visible feet.
- Origin is set to `(0.5, 112/128)` so `sprite.x, sprite.y` = visible feet (not PNG bottom). This keeps door/portal triggers and collisions aligned with what the player sees.
- Physics body: 20x16, offset to sit at the visible feet (`VISIBLE_FEET_Y - bodyH`).
- Side-view sprites only — no up/down frames. Up/down movement keeps last horizontal facing direction. Detection cone still tracks all 4 directions; only visual is constrained.

## Working with map JSONs
Tiled exports often reference external `.tsx` tileset files using absolute paths from the original author's machine (e.g. `..\..\..\..\..\..\Downloads\Japan City.tsx`). These break Phaser parsing. **Always embed the tileset block manually** when a new map JSON shows up:
```jsonc
{ "firstgid": 1, "name": "tiles-japan",
  "image": "../tiles/tiles-japan.png",
  "imagewidth": 1920, "imageheight": 768,
  "tilewidth": 32, "tileheight": 32,
  "tilecount": 1440, "columns": 60, "margin": 0, "spacing": 0 }
```
- The `image` path is metadata only — Phaser uses our explicit `addTilesetImage(name, imageKey)` mapping at runtime.
- `tilecount` must cover the max tile id used in the layer data (check with: `node -e "..."` script in past sessions). For autumn, the Objects tileset declares `tilecount: 1668` even though the image only has 1600 tiles, because the invisible Collision layer references tile id 2468 → that overflow is fine since the Collision layer never renders.
- The autumn map registers `Autumn_Forest_Tiles` twice (firstgid 1 AND firstgid 2401, named `Autumn_Forest_Tiles_2`). Both must be passed to `addTilesetImage` pointing at the same loaded image.

## Custom font
- `font-2.otf` registered as `GameFont` via `@font-face` in `index.html`.
- `main.ts` awaits `document.fonts.load('1em GameFont')` before constructing the game so first-frame text uses GameFont.
- All `Phaser.Text` styles use `fontFamily: 'GameFont, Arial'`.

## Item collection paths
- **Outdoor (map items):** magnifier button → `ItemManager.detectInArea` (3x3 tile box centered on player) → `collect()` (scale + fade) → `recordCollected(id)` to global registry → `UIManager.showItemPopup` → tick bar → `checkGlobalWin`.
- **Indoor (room items):** `RoomScene` renders sprite per uncollected item at image-pixel coords; sprite tracks the dragged image position. Tap (drag-vs-click discriminated by 3px movement threshold) → fade + persist → `UIManager.createItemPopup` (static) → tick local bar → win check → `triggerWin()` directly to `ResultScene` if applicable.

## Tunable knobs
- Player scale: `setScale(0.35)` in `PlayerController.ts:40`
- Player feet anchor: `VISIBLE_FEET_Y = 96` in `PlayerController.ts:34` *(was 112; user adjusted)*
- Hitbox: `bodyW = 20, bodyH = 16` in `PlayerController.ts:62-63`
- Detection box: `tileSize = 32` in `ItemManager.detectInArea`
- Item display in world: `targetSize = 28` in `ItemManager.spawnItems`
- Room item display: `targetSize = 56` in `RoomScene.createRoomItemSprites`
- Drag-vs-click threshold: `3` px in `RoomScene.createRoomImage`
- Popup duration: hold `1000ms`, in `400ms`, out `300ms` in `UIManager.createItemPopup`
- Layer depths: `MAP_CONFIGS` in `GameScene.ts`

## Common gotchas
- **Items mutate `collected: true`** — GameScene deep-clones items before passing to ItemManager so revisits show correct state.
- **`scene.restart` runs `shutdown()` then `create(data)`**. Registry persists. `events.on('resume')` in create runs every restart, but only matters when re-entering from a paused state.
- **CLAUDE.md / cases.json edits** don't reload until next dev server cycle — but the registry wipes `gameState` on each boot so you get a fresh game.
- Don't add a colon before tool calls; don't add comments explaining "what" the code does.

## Status (2026-05-11)
- ✅ Two outdoor maps with portal travel between them
- ✅ 5 room photos accessible via Door/Water trigger zones
- ✅ 10 items globally distributed; click-to-collect in rooms; magnifier outdoors
- ✅ Custom font, item collection popup, evidence bar shared everywhere
- ⏳ Room item positions are guessed (not visually placed yet) — retune in `cases.json`
- ⏳ No up/down player sprites; uses last horizontal facing
- ⏳ `map-desert.json` and `tiles-dessert.png` exist but unused
