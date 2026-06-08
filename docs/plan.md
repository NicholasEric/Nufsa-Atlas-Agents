# Plan & Current State

_Last updated: 2026-06-08._

## Decisions (from the project owner)

1. **Japan rooms → keep 4.** The new named photos (`balcony.jpg`, `living-room.jpg`, `shop.jpg`) replace some of the old generic rooms; **more room images are still coming.** Wire up the rooms that exist now; the 4th door can use a placeholder until its image is added.
2. **Desert = third outdoor map.** Travel chain: **Japan → Autumn → Desert → (back to Japan)**, though any order is acceptable. Desert gets its **own room(s) later**.
3. **Player physics body (96×96) is intentional for now** — the owner is actively tuning `PlayerController.ts`. **Do not change it.**

## Current state

✅ Working:
- Two outdoor maps (Kyoto District, Autumn Forest) with portal travel.
- Global progress state + shared evidence bar across maps and rooms.
- Outdoor magnifier collection; indoor drag-to-pan room collection.
- Timer (freezes in rooms, carries across travel), win/lose → ResultScene, custom font.
- `npx tsc --noEmit` passes clean.

## Known issues / unfinished

| # | Severity | Issue |
|---|----------|-------|
| 1 | ✅ Fixed | ~~Japan room wiring broken.~~ Done: Door1→balcony, Door2→living-room, Door3→shop; Door4 opens a generated `room-japan-placeholder`. 6 room items redistributed 2/2/2 with in-bounds coords. |
| 9 | ✅ Fixed | ~~Evidence bar inert in rooms (tapping did nothing).~~ Extracted a shared `EvidenceBar` component (icon slots + tap-to-describe) used by both GameScene and RoomScene; the duplicate read-only room bar is gone. |
| 2 | 🟡 | **5 of 10 item PNGs missing** (`lantern, sake, daruma, bonsai, kitsune-mask`) → placeholder circles. |
| 3 | 🟡 | **Desert map half-added** — JSON + tiles + room photo exist but nothing in `cases.json` / `MAP_CONFIGS` / `BootScene`. |
| 4 | ⚪ | **Room item x/y are guessed**, not visually placed on the photos. |
| 5 | ⚪ | No start/title screen or attract loop (kiosk nicety). |
| 8 | 🟡 | **`npm run build` fails** — `main.ts` uses top-level `await` but the esbuild/Vite `build.target` rejects it (`es2020`/chrome87…). `npm run dev` works fine. Fix: set `build.target: 'esnext'` in `vite.config`, or restructure `main.ts` to avoid top-level await. |
| 6 | ⚪ | No camera follow / world clamp is hardcoded to 1024×768 — fine for current maps, must change if a map is larger. |
| 7 | ⚪ | No up/down player sprites (keeps last horizontal facing — by design for now). |

## Roadmap

### Phase 1 — Unbreak Japan rooms ✅ DONE
- Room keys renamed to `room-japan-balcony` / `-living-room` / `-shop` in **BootScene** (load paths), **`MAP_CONFIGS.doors`** (imageKey + label), and **`cases.json`** room items' `location.area`.
- 6 Japan room items redistributed 2/2/2: balcony = hat + bonsai; living-room = katana + daruma; shop = fan + sake. Coords set within each photo's bounds (still rough — retune in Phase 3).
- Door4 opens a generated `room-japan-placeholder` ("Room coming soon") until its real photo is added; swap `imageKey` in `MAP_CONFIGS` + load the photo in BootScene when ready.
- ⏳ Still to verify in-browser: each door opens the right photo and items are tappable (run `npm run dev`).

### Phase 2 — Wire up the Desert map
- Embed the tileset block inline in `map-desert.json` (use `tiles-dessert-2.png`); confirm `tilecount` covers max tile id.
- Add `desert` case to `cases.json`; set the travel chain Japan → Autumn → Desert → Japan (update each case's `portalDestination`).
- Add `desert` to `MAP_CONFIGS` (tilesets, layer depths, `HiddenMove`, doors) and load it in `BootScene`.
- Add at least one outdoor item with `area: "desert"`. (Room comes later.)

### Phase 3 — Content & polish
- Add the 5 missing item PNGs.
- Build a quick placement overlay (e.g. log click coords on the room image) to set room item x/y accurately.
- Start/title screen + attract loop for kiosk.
- Sound pass.

## When adding a map, three files must agree
`cases.json` (case + items) ↔ `BootScene` (load tilemap + tileset image) ↔ `GameScene.MAP_CONFIGS` (tilesets, layers, doors). See [tuning.md](tuning.md) §3.
