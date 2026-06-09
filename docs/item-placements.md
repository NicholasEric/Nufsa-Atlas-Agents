# Item Placements

_Auto-generated 2026-06-09 from `src/data/cases.json` + asset sizes. Regenerate if you move items._

**How to read:** coordinates are pixels from the **top-left** of the container. For **maps** they are world pixels; for **room photos** they are pixels on the image. `%x/%y` show the position relative to the container size. The ASCII boxes are approximate — top-left of the box = (0,0).

## All items

| Item | Where | Type | x | y |
|------|-------|------|---|---|
| Bloody Yukata | Kyoto District | map | 150 | 80 |
| Rusted Katana | Japan — Living Room | room | 1200 | 900 |
| Torn Paper Fan | Japan — Shop | room | 400 | 400 |
| Straw Sugegasa | Japan — Balcony | room | 1000 | 1200 |
| Folded Crane | Autumn — Pond | room | 1100 | 400 |
| Paper Lantern | Autumn — Pond | room | 2300 | 400 |
| Sake Flask | Japan — Shop | room | 950 | 450 |
| Daruma Doll | Japan — Living Room | room | 2400 | 1300 |
| Toppled Bonsai | Japan — Balcony | room | 2600 | 1500 |
| Kitsune Mask | Autumn Forest | map | 500 | 400 |

## Kyoto District — map  (1024×768 px)

`area: "japan-2"`

| Item | x | y | %x | %y |
|------|---|---|----|----|
| Bloody Yukata | 150 | 80 | 15% | 10% |

```
+----------------------------------------+
|                                        |
|      A                                 |
|                                        |
|                                        |
|                                        |
|                                        |
|                                        |
|                                        |
|                                        |
|                                        |
|                                        |
|                                        |
+----------------------------------------+
A = Bloody Yukata
```

## Autumn Forest — map  (1024×768 px)

`area: "autumn"`

| Item | x | y | %x | %y |
|------|---|---|----|----|
| Kitsune Mask | 500 | 400 | 49% | 52% |

```
+----------------------------------------+
|                                        |
|                                        |
|                                        |
|                                        |
|                                        |
|                                        |
|                   A                    |
|                                        |
|                                        |
|                                        |
|                                        |
|                                        |
+----------------------------------------+
A = Kitsune Mask
```

## Japan — Balcony — room photo  (3830×2160 px)

`area: "room-japan-balcony"`

| Item | x | y | %x | %y |
|------|---|---|----|----|
| Straw Sugegasa | 1000 | 1200 | 26% | 56% |
| Toppled Bonsai | 2600 | 1500 | 68% | 69% |

```
+----------------------------------------+
|                                        |
|                                        |
|                                        |
|                                        |
|                                        |
|                                        |
|          A                             |
|                                        |
|                          B             |
|                                        |
|                                        |
|                                        |
+----------------------------------------+
A = Straw Sugegasa   B = Toppled Bonsai
```

## Japan — Living Room — room photo  (3567×2000 px)

`area: "room-japan-living-room"`

| Item | x | y | %x | %y |
|------|---|---|----|----|
| Rusted Katana | 1200 | 900 | 34% | 45% |
| Daruma Doll | 2400 | 1300 | 67% | 65% |

```
+----------------------------------------+
|                                        |
|                                        |
|                                        |
|                                        |
|                                        |
|             A                          |
|                                        |
|                          B             |
|                                        |
|                                        |
|                                        |
|                                        |
+----------------------------------------+
A = Rusted Katana   B = Daruma Doll
```

## Japan — Shop — room photo  (1370×768 px)

`area: "room-japan-shop"`

| Item | x | y | %x | %y |
|------|---|---|----|----|
| Torn Paper Fan | 400 | 400 | 29% | 52% |
| Sake Flask | 950 | 450 | 69% | 59% |

```
+----------------------------------------+
|                                        |
|                                        |
|                                        |
|                                        |
|                                        |
|                                        |
|           A               B            |
|                                        |
|                                        |
|                                        |
|                                        |
|                                        |
+----------------------------------------+
A = Torn Paper Fan   B = Sake Flask
```

## Autumn — Pond — room photo  (3200×800 px)

`area: "room-autumn-1"`

| Item | x | y | %x | %y |
|------|---|---|----|----|
| Folded Crane | 1100 | 400 | 34% | 50% |
| Paper Lantern | 2300 | 400 | 72% | 50% |

```
+----------------------------------------+
|                                        |
|                                        |
|                                        |
|                                        |
|                                        |
|                                        |
|             A              B           |
|                                        |
|                                        |
|                                        |
|                                        |
|                                        |
+----------------------------------------+
A = Folded Crane   B = Paper Lantern
```

## Containers with no items yet

These are wired and explorable but hold no items currently:

- **Desert Oasis** (map, 512×384 px) — `desert`
- **Castle Keep** (map, 992×704 px) — `castle`
- **Dungeon** (map, 320×208 px) — `dungeon`
- **Island** (map, 1856×1408 px) — `island`
- **Desert — Tent** (room photo, 2133×1200 px) — `room-desert-1`

Also: the generated `room-placeholder` (Japan Door4, dungeon & island doors) has no items.
