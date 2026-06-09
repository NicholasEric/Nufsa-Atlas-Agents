# Plan & Current State

_Last updated: 2026-06-08._

## Decisions (from the project owner)

1. **Japan rooms → keep 4.** The new named photos (`balcony.jpg`, `living-room.jpg`, `shop.jpg`) replace some of the old generic rooms; **more room images are still coming.** Wire up the rooms that exist now; the 4th door can use a placeholder until its image is added.
2. **Six maps, looping travel chain:** **Japan → Autumn → Desert → Castle → Dungeon → Island → (loop back to Japan).**
3. **New maps are explorable-only for now** — no items placed on desert/castle/dungeon/island yet (win condition stays at the current 10 items). dungeon & island `Door1` open the shared placeholder room until photos exist.
4. **Player physics body (96×96) is intentional for now** — the owner is actively tuning `PlayerController.ts`. The only change made there was the surgical map-size-aware clamp (approved); scale/feet/hitbox left alone.

## Current state

✅ Working:
- **Six** outdoor maps with a looping portal chain (Japan, Autumn, Desert, Castle, Dungeon, Island).
- Per-map camera: maps that fit the screen are centered/static; larger maps (island) follow the player; player clamps to each map's pixel bounds.
- Global progress state + shared `EvidenceBar` (icon slots, tap-to-describe) across maps and rooms.
- Outdoor magnifier collection; indoor drag-to-pan room collection.
- Timer (freezes in rooms, carries across travel), win/lose → ResultScene, custom font.
- `npx tsc --noEmit` passes clean.

## Known issues / unfinished

| # | Severity | Issue |
|---|----------|-------|
| 1 | ✅ Fixed | ~~Japan room wiring broken.~~ Done: Door1→balcony, Door2→living-room, Door3→shop; Door4 opens a generated `room-japan-placeholder`. 6 room items redistributed 2/2/2 with in-bounds coords. |
| 9 | ✅ Fixed | ~~Evidence bar inert in rooms.~~ Then redesigned: the shared component is now `CaseFile` — a bottom-left button opening a paged parchment book (description + "?" until found, icon + FOUND stamp once collected). Shared by GameScene + RoomScene. |
| 13 | ✅ Done | **Multi-destination portals.** Auto-discovered from `<Destination>Portal` tile layers (Japan→japan-2); `HiddenMove` dropped. On travel the player spawns on the destination's return portal ("spawn-back"). `MAP_CONFIGS.portals[]` still overrides if needed. |
| 2 | 🟡 | **5 of 10 item PNGs missing** (`lantern, sake, daruma, bonsai, kitsune-mask`) → placeholder circles. |
| 3 | ✅ Fixed | ~~Desert map half-added.~~ Tileset embedded (2 images), wired into `cases.json` / `MAP_CONFIGS` / `BootScene`; `Door1` → `room-desert-1`. |
| 4 | ⚪ | **Room item x/y are guessed**, not visually placed on the photos. |
| 5 | ⚪ | No start/title screen or attract loop (kiosk nicety). |
| 8 | 🟡 | **`npm run build` fails** — `main.ts` uses top-level `await` but the esbuild/Vite `build.target` rejects it (`es2020`/chrome87…). `npm run dev` works fine. Fix: set `build.target: 'esnext'` in `vite.config`, or restructure `main.ts` to avoid top-level await. |
| 6 | ✅ Fixed | ~~No camera follow / hardcoded 1024×768 clamp.~~ GameScene now sets per-map camera + world bounds (center static if it fits, follow if larger); PlayerController clamps to `mapWidth/mapHeight` from config. |
| 7 | ⚪ | No up/down player sprites (keeps last horizontal facing — by design for now). |
| 10 | ⚪ | New maps (desert/castle/dungeon/island) are **explorable-only** — no items yet, and their layer depths + spawn points are first-pass guesses (tunable in `MAP_CONFIGS`). |
| 12 | ✅ Fixed | ~~Maps looked odd at different sizes.~~ `setupCameras()` zooms each map to fit 1024×768 (centered, static) and renders the HUD on a separate un-zoomed UI camera. Non-4:3 maps get thin letterbox bars; flip `min`→`max` in `setupCameras` for crop-to-fill instead. |
| 11 | ⚪ | Timer is **shared across all 6 maps** (carries through travel). Traversing the full loop in 5 min is tight; revisit per-map time / limit when items land on the new maps. |

## Roadmap

### Phase 1 — Unbreak Japan rooms ✅ DONE
- Room keys renamed to `room-japan-balcony` / `-living-room` / `-shop` in **BootScene** (load paths), **`MAP_CONFIGS.doors`** (imageKey + label), and **`cases.json`** room items' `location.area`.
- 6 Japan room items redistributed 2/2/2: balcony = hat + bonsai; living-room = katana + daruma; shop = fan + sake. Coords set within each photo's bounds (still rough — retune in Phase 3).
- Door4 opens a generated `room-japan-placeholder` ("Room coming soon") until its real photo is added; swap `imageKey` in `MAP_CONFIGS` + load the photo in BootScene when ready.
- ⏳ Still to verify in-browser: each door opens the right photo and items are tappable (run `npm run dev`).

### Phase 2 — Wire up Desert + Castle + Dungeon + Island ✅ DONE
- Desert tileset embedded (two images: `desert-doodles` 192×144/108 tiles, `desert-tiles` 224×240/210 tiles); `Door1` → `room-desert-1`.
- Castle/dungeon/island already had embedded `spritefusion` tilesets (Downloads `image` path is metadata, ignored) → just loaded + mapped to `tiles-castle/dungeon/island`.
- All four added to `BootScene`, `MAP_CONFIGS`, and `cases.json`; portal chain looped Japan→Autumn→Desert→Castle→Dungeon→Island→Japan.
- Per-map camera + world bounds added (handles island > screen and dungeon < screen).
- ⏳ Verify in-browser: walk each map, check collision/portals/depths look right; retune `layerDepths` and spawn points in `MAP_CONFIGS` as needed.

### Phase 3 — Content & polish
- Place items on the new maps (currently explorable-only); revisit the shared timer once they have content.
- Add the 5 missing item PNGs; real room photos for dungeon/island (replace placeholder).
- Build a quick placement overlay (log click coords) to set room item x/y accurately.
- Start/title screen + attract loop for kiosk; sound pass.

## When adding a map, three files must agree
`cases.json` (case + items) ↔ `BootScene` (load tilemap + tileset image) ↔ `GameScene.MAP_CONFIGS` (tilesets, layers, doors). See [tuning.md](tuning.md) §3.
