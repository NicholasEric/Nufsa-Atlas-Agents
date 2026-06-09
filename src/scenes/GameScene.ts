import { Scene } from 'phaser';
import { SceneKeys, CaseData, ItemData, GameConfig } from '../types/game.types';
import { PlayerController } from '../system/PlayerController';
import { ItemManager } from '../system/ItemManager';
import { UIManager } from '../system/UIManager';
import { getAudioManager } from '../system/AudioManager';

/**
 * GameScene is the main gameplay scene.
 * Handles player movement, item detection, collection, and win/lose conditions.
 */
export class GameScene extends Scene {
  /** Current case configuration */
  private caseData: CaseData | null = null;

  /** Player controller instance */
  private player: PlayerController | null = null;

  /** Item manager instance */
  private itemManager: ItemManager | null = null;

  /** UI manager instance */
  private ui: UIManager | null = null;

  /** Audio manager instance */
  private audio = getAudioManager();

  /** Time remaining in seconds */
  private timeRemaining: number = 300;

  /** Timer event for countdown */
  private timerEvent: Phaser.Time.TimerEvent | null = null;

  /** Whether the game is paused (e.g., modal open) */
  private isPaused: boolean = false;

  /** Tilemap reference */
  private tilemap: Phaser.Tilemaps.Tilemap | null = null;

  /** Collision layer reference */
  private collisionLayer: Phaser.Tilemaps.TilemapLayer | null = null;

  /** Visible tilemap layers — assigned to the zoomed world camera. */
  private worldLayers: Phaser.Tilemaps.TilemapLayer[] = [];

  /** Separate un-zoomed camera that renders the HUD. */
  private uiCamera: Phaser.Cameras.Scene2D.Camera | null = null;

  /** Current case ID (e.g., "japan-2", "autumn"). */
  private caseId: string = 'japan-2';

  /**
   * Tile coords ("col,row") → portal config. Different portal tiles can
   * lead to different destination maps (not just one circular hop).
   */
  private portalTiles: Map<string, { destination: string; label: string }> = new Map();

  /** Currently-active portal tile key, or null if not on one. */
  private activePortalKey: string | null = null;

  /** Destination of the active portal (used by the travel button). */
  private activePortalDest: string | null = null;

  /**
   * Per-destination spawn points (world px) — the center of THIS map's
   * portal that leads to each destination. Arriving from map S, the player
   * spawns at `portalSpawns.get(S)` (i.e. on the portal back to S).
   */
  private portalSpawns: Map<string, { x: number; y: number }> = new Map();

  /** The map the player just travelled from (for spawn placement), or null. */
  private spawnFromCaseId: string | null = null;

  /** Tile coords ("col,row") → door config for room-view interactions. */
  private doorTiles: Map<string, { imageKey: string; label: string }> = new Map();

  /** Currently-active door key ("col,row"), or null if not on a door tile. */
  private activeDoorKey: string | null = null;

  constructor() {
    super({ key: SceneKeys.Game });
  }

  create(data?: { caseId?: string; fromCaseId?: string }): void {
    // Initialize audio manager with this scene
    this.audio.init(this);

    // Pick which case to load. Defaults to japan-2 (the entry map).
    this.caseId = data?.caseId ?? 'japan-2';
    // Which map we travelled from — used to spawn on the matching return
    // portal. Null on a fresh boot.
    this.spawnFromCaseId = data?.fromCaseId ?? null;

    // Read the global config: items[] (all 10) + cases{} (per-map config).
    const cfg = this.registry.get('gameConfig') as GameConfig;
    const sourceCase = cfg.cases[this.caseId];
    if (!sourceCase) {
      console.error(`No case data found for caseId="${this.caseId}"`);
      return;
    }
    this.caseData = sourceCase;

    // Restore global game state (flat collected ids + remaining time).
    const gameState = this.registry.get('gameState') as
      | { timeRemaining?: number; collectedIds?: string[] }
      | undefined;
    this.timeRemaining = gameState?.timeRemaining ?? this.caseData.timeLimitSeconds;
    const collectedIds = new Set(gameState?.collectedIds ?? []);

    // Build the per-map item subset (just the items that live on THIS
    // map). Mark already-collected items so ItemManager skips spawning
    // them.
    const mapItems: ItemData[] = cfg.items
      .filter(it => it.location.type === 'map' && it.location.area === this.caseId)
      .map(it => ({ ...it, collected: collectedIds.has(it.id) }));

    // Create the map (data-driven by caseId)
    this.createMap();

    // Create player
    this.createPlayer();

    // Create item manager for outdoor items only.
    this.itemManager = new ItemManager(this, mapItems);

    // Create UI. The bottom evidence bar shows ALL 10 items globally,
    // not just the ones on this map.
    this.ui = new UIManager(this);
    this.ui.populateItemList(this, cfg.items);
    this.ui.updateTimer(this.timeRemaining);
    for (const item of cfg.items) {
      if (collectedIds.has(item.id)) this.ui.updateItemEntry(item.id, true);
    }

    // Wire up callbacks
    this.wireCallbacks();

    // Split rendering across a zoomed world camera + a fixed UI camera so
    // every map fills 1024x768 without scaling the HUD.
    this.setupCameras();

    // Start countdown timer
    this.startTimer();

    // Start background music
    if (this.caseData.ambientAudioKey) {
      this.audio.playMusic(this.caseData.ambientAudioKey);
    }

    // Track input for idle detection
    this.input.on('pointerdown', () => {
      // Could track for idle detection if needed
    });

    // When this scene is resumed (after RoomScene closes), refresh the
    // bottom bar from the global collectedIds so room collections show
    // up, and trigger end-game if a room collected the final item.
    this.events.on('resume', () => this.onResumeFromRoom());
  }

  /**
   * Called when GameScene resumes after RoomScene closes. Pulls the
   * latest global collectedIds, ticks any newly-collected entries on the
   * bar, and triggers endGame(true) if all items are now collected.
   */
  private onResumeFromRoom(): void {
    const cfg = this.registry.get('gameConfig') as GameConfig;
    const gameState = this.registry.get('gameState') as
      | { collectedIds?: string[] }
      | undefined;
    const collectedIds = new Set(gameState?.collectedIds ?? []);
    for (const item of cfg.items) {
      if (collectedIds.has(item.id)) this.ui?.updateItemEntry(item.id, true);
    }
    if (collectedIds.size >= cfg.items.length) {
      this.endGame(true);
    }
  }

  /**
   * Per-case map setup table. Each entry knows which tilesets to register
   * (mapping the JSON tileset name → the preloaded image key) and which
   * visual layers to create at which depth.
   */
  private static readonly MAP_CONFIGS: Record<
    string,
    {
      tilemapKey: string;
      tilesets: Array<{ name: string; imageKey: string }>;
      layerDepths: Array<{ name: string; depth: number }>;
      /** Interaction-zone layers that, when stepped on, show a button to
       *  open a room photo via RoomScene. */
      doors?: Array<{ layerName: string; imageKey: string; label: string }>;
      /** Portal layers → travel destinations. Each layer is a trigger zone
       *  that sends the player to a different map. If omitted, the single
       *  `HiddenMove` layer is used with the case's `portalDestination`. */
      portals?: Array<{ layerName: string; destination: string; label?: string }>;
    }
  > = {
    'japan-2': {
      tilemapKey: 'japan-2-map',
      tilesets: [{ name: 'tiles-japan', imageKey: 'tiles-japan' }],
      layerDepths: [
        { name: 'Ground', depth: -2 },
        { name: 'Decorations', depth: -1 },
        { name: 'Buildings', depth: 0 },
        { name: 'Behind', depth: 10 },
      ],
      doors: [
        { layerName: 'Door1', imageKey: 'room-japan-balcony', label: 'Enter Balcony' },
        { layerName: 'Door2', imageKey: 'room-japan-living-room', label: 'Enter Living Room' },
        { layerName: 'Door3', imageKey: 'room-japan-shop', label: 'Enter Shop' },
        // Door4's real photo isn't ready yet → opens the generated
        // 'room-placeholder' texture (no items live here yet).
        { layerName: 'Door4', imageKey: 'room-placeholder', label: 'Locked Room' },
      ],
    },
    autumn: {
      tilemapKey: 'autumn-map',
      tilesets: [
        { name: 'Autumn_Forest_Tiles', imageKey: 'autumn-tiles' },
        { name: 'Autumn_Forest_Objects', imageKey: 'autumn-objects' },
        // Map JSON registers tiles a second time at firstgid 2401; reuses
        // the already-loaded image.
        { name: 'Autumn_Forest_Tiles_2', imageKey: 'autumn-tiles' },
      ],
      layerDepths: [
        { name: 'Ground', depth: -2 },
        { name: 'leaves', depth: -1 },
        { name: 'Decorations', depth: 0 },
        { name: 'objects', depth: 0 },
        { name: 'extra smol deco', depth: 0 },
        { name: 'extra extra smol deco', depth: 0 },
        { name: 'Buildings', depth: 0 },
        { name: 'smoll tree', depth: 10 },
        { name: 'Behind', depth: 10 },
      ],
      doors: [
        { layerName: 'Water1', imageKey: 'room-autumn-1', label: 'Look at Pond' },
      ],
    },
    desert: {
      tilemapKey: 'desert-map',
      tilesets: [
        { name: 'desert-doodles', imageKey: 'desert-doodles' },
        { name: 'desert-tiles', imageKey: 'desert-tiles' },
      ],
      layerDepths: [
        { name: 'Ground', depth: -2 },
        { name: 'lake', depth: -1 },
        { name: 'rock', depth: 0 },
        { name: 'Building', depth: 0 },
        { name: '2nd storey', depth: 10 },
        { name: 'tent storey', depth: 10 },
      ],
      doors: [
        { layerName: 'Door1', imageKey: 'room-desert-1', label: 'Enter Tent' },
      ],
    },
    castle: {
      tilemapKey: 'castle-map',
      tilesets: [{ name: 'spritefusion', imageKey: 'tiles-castle' }],
      layerDepths: [
        { name: 'Background walls', depth: -2 },
        { name: 'Walls', depth: -1 },
        { name: 'Platforms large', depth: 0 },
        { name: 'Platform small', depth: 0 },
        { name: 'Windows', depth: 0 },
        { name: 'Banner', depth: 10 },
      ],
    },
    dungeon: {
      tilemapKey: 'dungeon-map',
      tilesets: [{ name: 'spritefusion', imageKey: 'tiles-dungeon' }],
      layerDepths: [
        { name: 'Floor', depth: -2 },
        { name: 'Walls', depth: -1 },
        { name: 'Walls sides', depth: -1 },
        { name: 'Traps', depth: -1 },
        { name: 'Doors', depth: 0 },
        { name: 'Pickups', depth: 0 },
        { name: 'Miscs', depth: 0 },
        { name: 'Walls pillars', depth: 10 },
        { name: 'Gargoyles', depth: 10 },
      ],
      doors: [
        { layerName: 'Door1', imageKey: 'room-placeholder', label: 'Enter Room' },
      ],
    },
    island: {
      tilemapKey: 'island-map',
      tilesets: [{ name: 'spritefusion', imageKey: 'tiles-island' }],
      layerDepths: [
        { name: 'Background', depth: -3 },
        { name: 'Sand', depth: -2 },
        { name: 'Cliff', depth: -2 },
        { name: 'Rocks', depth: -1 },
        { name: 'Grass', depth: -1 },
        { name: 'Bridge - vertical', depth: -1 },
        { name: 'Bridge - horizontal', depth: -1 },
        { name: 'Stairs', depth: -1 },
        { name: 'Shadows', depth: -1 },
        { name: 'Small rocks', depth: 0 },
        { name: 'Trees back', depth: 0 },
        { name: 'Buildings', depth: 0 },
        { name: 'Miscs', depth: 0 },
        { name: 'Trees front', depth: 10 },
      ],
      doors: [
        { layerName: 'Door1', imageKey: 'room-placeholder', label: 'Enter Hut' },
      ],
    },
  };

  /**
   * Sanitizes a cached Tiled map before parsing. Tiled re-adds the original
   * tileset as an external `.tsx` reference (a broken `…/Downloads/*.tsx`
   * path) whenever you paint with it — e.g. after adding portal layers —
   * which Phaser can't load. This:
   *   1. drops every external (`source`) tileset, then
   *   2. remaps any tile gid that referenced a dropped tileset to gid 1, so
   *      Phaser's parser (AssignTileProperties does `tiles[gid][2]`) doesn't
   *      crash on a now-dangling gid.
   * Remapped tiles stay non-empty (so invisible portal/trigger layers still
   * register) and never render. No visible art is affected because the
   * embedded tilesets already cover every rendered tile. Idempotent.
   */
  private stripExternalTilesets(key: string): void {
    const entry = this.cache.tilemap.get(key) as
      | { data?: { tilesets?: any[]; layers?: any[] } }
      | undefined;
    const data = entry?.data;
    if (!data || !Array.isArray(data.tilesets)) return;

    const removed = data.tilesets.filter(ts => ts && ts.source);
    if (removed.length === 0) return;
    for (const ts of removed) {
      console.warn(`[GameScene] Dropping unresolvable external tileset "${ts.source}" from "${key}".`);
    }
    data.tilesets = data.tilesets.filter(ts => !(ts && ts.source));

    // Valid gid ranges from the remaining (embedded) tilesets.
    const ranges = data.tilesets
      .filter(ts => typeof ts.firstgid === 'number' && typeof ts.tilecount === 'number')
      .map(ts => [ts.firstgid, ts.firstgid + ts.tilecount - 1] as [number, number]);
    const GID_MASK = 0x1fffffff; // strip Tiled's H/V/D flip flags
    const isValid = (gid: number) => ranges.some(r => gid >= r[0] && gid <= r[1]);

    for (const layer of data.layers ?? []) {
      if (layer.type !== 'tilelayer' || !Array.isArray(layer.data)) continue;
      for (let i = 0; i < layer.data.length; i++) {
        const raw = layer.data[i];
        if (!raw) continue;
        if (!isValid(raw & GID_MASK)) layer.data[i] = 1;
      }
    }
  }

  /**
   * Creates the game map from the Tiled tilemap configured for this case.
   * Also parses the optional HiddenMove layer into portal tile coords.
   */
  private createMap(): void {
    const cfg = GameScene.MAP_CONFIGS[this.caseId];
    if (!cfg) {
      console.error(`No MAP_CONFIGS entry for caseId="${this.caseId}"`);
      return;
    }

    this.stripExternalTilesets(cfg.tilemapKey);
    this.tilemap = this.make.tilemap({ key: cfg.tilemapKey });
    this.worldLayers = [];

    const sets: Phaser.Tilemaps.Tileset[] = [];
    for (const ts of cfg.tilesets) {
      const set = this.tilemap.addTilesetImage(ts.name, ts.imageKey);
      if (!set) {
        console.error(`Failed to add tileset "${ts.name}" with image "${ts.imageKey}"`);
        return;
      }
      sets.push(set);
    }

    for (const { name, depth } of cfg.layerDepths) {
      const layer = this.tilemap.createLayer(name, sets, 0, 0);
      if (layer) {
        layer.setDepth(depth);
        this.worldLayers.push(layer);
      }
    }

    // Collision layer: invisible, every non-empty tile blocks movement.
    // Resolved case-insensitively because some maps name it "collision"
    // (e.g. desert) instead of "Collision".
    const collisionName = this.resolveLayerName('Collision');
    this.collisionLayer = collisionName
      ? this.tilemap.createLayer(collisionName, sets, 0, 0)
      : null;
    if (this.collisionLayer) {
      this.collisionLayer.setVisible(false);
      this.collisionLayer.setCollisionByExclusion([-1, 0]);
    }

    // Portal layers: invisible travel triggers, auto-discovered by name
    // convention ("<Destination>Portal" tile layers, e.g. DesertPortal).
    // The legacy `HiddenMove` layer is no longer used. An explicit
    // `MAP_CONFIGS.portals` array overrides discovery if present.
    const gameConfig = this.registry.get('gameConfig') as GameConfig;
    const portalDefs = cfg.portals ?? this.discoverPortalDefs(gameConfig);
    const parsed = this.parsePortals(portalDefs, gameConfig);
    this.portalTiles = parsed.tiles;
    this.portalSpawns = parsed.spawns;

    // Door layers: each configured door layer becomes a set of tiles that
    // open a specific room photo when the player steps on them.
    this.doorTiles = this.parseDoorTiles(cfg.doors ?? []);
  }

  /**
   * Reads each configured door layer and builds a single coord-keyed map
   * from "col,row" → { imageKey, label }. The layers themselves are
   * rendered invisibly so the trigger tiles aren't visible to the player.
   */
  private parseDoorTiles(
    doors: Array<{ layerName: string; imageKey: string; label: string }>
  ): Map<string, { imageKey: string; label: string }> {
    const result = new Map<string, { imageKey: string; label: string }>();
    if (!this.tilemap) return result;

    for (const door of doors) {
      const layerData = this.tilemap.getLayer(door.layerName);
      if (!layerData) continue;
      for (let row = 0; row < layerData.height; row++) {
        for (let col = 0; col < layerData.width; col++) {
          const tile = layerData.data[row][col];
          if (tile && tile.index > 0) {
            result.set(`${col},${row}`, { imageKey: door.imageKey, label: door.label });
          }
        }
      }
      // Render invisibly so the layer exists but doesn't show.
      const rendered = this.tilemap.createLayer(door.layerName, this.tilemap.tilesets, 0, 0);
      if (rendered) rendered.setVisible(false);
    }

    return result;
  }

  /**
   * Resolves a layer name case-insensitively against the loaded tilemap,
   * returning the actual stored name (or null). Lets map authors use
   * "collision" or "Collision", "hiddenmove" or "HiddenMove", etc.
   */
  private resolveLayerName(target: string): string | null {
    if (!this.tilemap) return null;
    const t = target.toLowerCase();
    const ld = this.tilemap.layers.find(l => l.name.toLowerCase() === t);
    return ld ? ld.name : null;
  }

  /**
   * Maps a portal-name token to a case id (identity except "japan" →
   * "japan-2"). Portal layers are named "<Token>Portal".
   */
  private static tokenToCase(token: string): string {
    return token === 'japan' ? 'japan-2' : token;
  }

  /**
   * Auto-discovers portal layers by naming convention: any tile layer
   * named "<Destination>Portal" (e.g. DesertPortal, JapanPortal) becomes a
   * portal to that destination map. Unknown destinations are skipped.
   */
  private discoverPortalDefs(
    gameConfig: GameConfig
  ): Array<{ layerName: string; destination: string }> {
    const defs: Array<{ layerName: string; destination: string }> = [];
    if (!this.tilemap) return defs;
    for (const ld of this.tilemap.layers) {
      const m = /^(.+)portal$/i.exec(ld.name);
      if (!m) continue;
      const destination = GameScene.tokenToCase(m[1].toLowerCase());
      if (!gameConfig.cases[destination]) {
        console.warn(`Portal layer "${ld.name}" → unknown case "${destination}"; skipped`);
        continue;
      }
      defs.push({ layerName: ld.name, destination });
    }
    return defs;
  }

  /**
   * Builds the portal lookups from a set of portal layers:
   *  - `tiles`: "col,row" → { destination, label } for the travel button.
   *  - `spawns`: destination caseId → world center of that portal, so the
   *    player can spawn on the portal leading back to where they arrived
   *    from. Each layer is rendered invisibly.
   */
  private parsePortals(
    defs: Array<{ layerName: string; destination: string; label?: string }>,
    gameConfig: GameConfig
  ): {
    tiles: Map<string, { destination: string; label: string }>;
    spawns: Map<string, { x: number; y: number }>;
  } {
    const tiles = new Map<string, { destination: string; label: string }>();
    const spawns = new Map<string, { x: number; y: number }>();
    if (!this.tilemap) return { tiles, spawns };

    const tw = this.tilemap.tileWidth;
    const th = this.tilemap.tileHeight;

    for (const def of defs) {
      const layerName = this.resolveLayerName(def.layerName);
      if (!layerName) continue;
      const layerData = this.tilemap.getLayer(layerName);
      if (!layerData) continue;

      const destLocation = gameConfig.cases[def.destination]?.location ?? def.destination;
      const label = def.label ?? `→ Travel to ${destLocation}`;

      let minCol = Infinity;
      let minRow = Infinity;
      let maxCol = -Infinity;
      let maxRow = -Infinity;

      for (let row = 0; row < layerData.height; row++) {
        for (let col = 0; col < layerData.width; col++) {
          const tile = layerData.data[row][col];
          if (tile && tile.index > 0) {
            tiles.set(`${col},${row}`, { destination: def.destination, label });
            minCol = Math.min(minCol, col);
            maxCol = Math.max(maxCol, col);
            minRow = Math.min(minRow, row);
            maxRow = Math.max(maxRow, row);
          }
        }
      }

      // Spawn point = world center of the portal's tile footprint.
      if (maxCol >= 0) {
        spawns.set(def.destination, {
          x: ((minCol + maxCol + 1) / 2) * tw,
          y: ((minRow + maxRow + 1) / 2) * th,
        });
      }

      const rendered = this.tilemap.createLayer(layerName, this.tilemap.tilesets, 0, 0);
      if (rendered) rendered.setVisible(false);
    }

    return { tiles, spawns };
  }

  /**
   * Creates the player character and sets up the camera + world bounds
   * for the current map (which may be smaller or larger than the screen).
   */
  private createPlayer(): void {
    const mapW = this.tilemap?.widthInPixels ?? this.scale.width;
    const mapH = this.tilemap?.heightInPixels ?? this.scale.height;

    // Spawn on the portal that leads back to the map we travelled from, so
    // the player emerges at the corresponding portal. On a fresh boot (no
    // origin), default near (300,300), clamped to small maps.
    const portalSpawn = this.spawnFromCaseId
      ? this.portalSpawns.get(this.spawnFromCaseId)
      : undefined;
    const startX = portalSpawn ? portalSpawn.x : Math.min(300, mapW / 2);
    const startY = portalSpawn ? portalSpawn.y : Math.min(300, mapH / 2);

    // Scale the player by 1/zoom so it renders at a consistent ON-SCREEN
    // size on every map (matching japan, which is zoom 1 @ scale 0.3),
    // regardless of the per-map camera zoom or tile size.
    const playerScale = 0.3 / this.fitZoom(mapW, mapH);

    this.player = new PlayerController(this, {
      startX,
      startingY: startY,
      speed: 150,
      spriteKey: 'player-idle-1',
      mapWidth: mapW,
      mapHeight: mapH,
      scale: playerScale,
    });

    // Add collision with tilemap collision layer
    if (this.collisionLayer) {
      this.physics.add.collider(this.player.sprite, this.collisionLayer);
    }

    this.physics.world.setBounds(0, 0, mapW, mapH);
  }

  /**
   * The uniform zoom that fits the current map inside the 1024x768 screen
   * (contain). Used by both the world camera and the inverse player scale.
   */
  private fitZoom(mapW: number, mapH: number): number {
    return Math.min(this.scale.width / mapW, this.scale.height / mapH);
  }

  /**
   * Sets up two cameras so every map presents at a consistent 1024x768:
   *  - the world camera (main) zooms each map to fit the screen and stays
   *    centered/static, so small maps fill the view and large ones aren't
   *    cut off;
   *  - a second UI camera renders the HUD at zoom 1 so the timer, evidence
   *    bar, and magnifier never scale with the per-map zoom.
   * Each camera ignores the other's objects to avoid double-drawing.
   * Called once per create(), after the map, player, items, and UI exist.
   */
  private setupCameras(): void {
    if (!this.player || !this.itemManager || !this.ui) return;

    const viewW = this.scale.width;
    const viewH = this.scale.height;
    const mapW = this.tilemap?.widthInPixels ?? viewW;
    const mapH = this.tilemap?.heightInPixels ?? viewH;

    // Fit (contain): largest uniform zoom that keeps the whole map visible.
    const zoom = this.fitZoom(mapW, mapH);

    const world = this.cameras.main;
    world.setBounds(0, 0, mapW, mapH);
    world.setZoom(zoom);
    world.stopFollow();
    world.centerOn(mapW / 2, mapH / 2);

    // Fresh UI camera each create (the previous one is torn down on
    // shutdown). It shares the screen but never zooms or scrolls.
    this.uiCamera = this.cameras.add(0, 0, viewW, viewH);
    this.uiCamera.setScroll(0, 0);

    const worldObjects: Phaser.GameObjects.GameObject[] = [
      ...this.worldLayers,
      this.player.sprite,
      ...this.itemManager.getSprites(),
    ];
    const uiObjects: Phaser.GameObjects.GameObject[] = [
      ...this.ui.getCameraObjects(),
      ...this.player.getScreenSpaceObjects(),
    ];

    world.ignore(uiObjects);
    this.uiCamera.ignore(worldObjects);
  }

  /**
   * Wires up event callbacks between systems.
   */
  private wireCallbacks(): void {
    // Item collected callback
    this.itemManager!.onItemCollected = (item: ItemData) => {
      this.onItemCollected(item);
    };

    // Magnifier button callback
    this.ui!.onMagnifierPressed = () => {
      this.onMagnifierPressed();
    };

    // Modal state callback
    this.ui!.onModalStateChanged = (isOpen: boolean) => {
      this.isPaused = isOpen;
    };

    // Travel button callback
    this.ui!.onTravelPressed = () => {
      this.onTravelPressed();
    };
  }

  /**
   * Triggered by the travel button. Stashes the current case's progress
   * (collected item ids + remaining time) into the registry and restarts
   * the scene targeting the configured portalDestination case.
   */
  private onTravelPressed(): void {
    // Destination of the portal the player is standing on (falls back to
    // the case's single portalDestination for legacy single-portal maps).
    const dest = this.activePortalDest ?? this.caseData?.portalDestination;
    if (!dest) return;

    // Carry remaining time forward; collectedIds is already maintained
    // globally via recordCollected(), nothing to merge per-case.
    const prev = (this.registry.get('gameState') as
      | { timeRemaining?: number; collectedIds?: string[] }
      | undefined) ?? {};
    this.registry.set('gameState', {
      ...prev,
      timeRemaining: this.timeRemaining,
    });

    this.scene.restart({ caseId: dest, fromCaseId: this.caseId });
  }

  /**
   * Starts the countdown timer.
   */
  private startTimer(): void {
    this.timerEvent = this.time.addEvent({
      delay: 1000, // 1 second
      callback: this.onTimerTick,
      callbackScope: this,
      repeat: this.timeRemaining,
    });
  }

  /**
   * Called every second by the timer.
   */
  private onTimerTick(): void {
    if (this.isPaused) return;

    this.timeRemaining--;
    this.ui?.updateTimer(this.timeRemaining);

    // Check for time's up
    if (this.timeRemaining <= 0) {
      this.endGame(false);
    }
  }

  /**
   * Called when the magnifier button is pressed.
   * Triggers item detection.
   */
  private onMagnifierPressed(): void {
    if (!this.player || !this.itemManager || this.isPaused) return;

    // Play detection sound
    this.audio.playDetect();

    // Get player position
    const playerPos = this.player.getPosition();

    // Detect items in a 3x3 tile area centered on the player
    const detection = this.itemManager.detectInArea(playerPos);

    if (detection.found && detection.item) {
      const collectedItem = detection.item;
      this.itemManager.collect(this, collectedItem, () => {
        this.audio.playCollect();
        // Persist into the global collectedIds set (shared across maps
        // and rooms — same evidence bar everywhere).
        this.recordCollected(collectedItem.id);
        // Celebration popup, then tick the bar + check global win.
        this.ui?.showItemPopup(this, collectedItem, () => {
          this.ui?.updateItemEntry(collectedItem.id, true);
          this.checkGlobalWin();
        });
      });
    }
  }

  /**
   * Adds an item id to the global `gameState.collectedIds` set in the
   * registry. Idempotent — safe to call twice.
   */
  private recordCollected(itemId: string): void {
    const prev = (this.registry.get('gameState') as
      | { timeRemaining?: number; collectedIds?: string[] }
      | undefined) ?? {};
    const ids = new Set(prev.collectedIds ?? []);
    ids.add(itemId);
    this.registry.set('gameState', {
      ...prev,
      timeRemaining: this.timeRemaining,
      collectedIds: [...ids],
    });
  }

  /**
   * Triggers endGame(true) if all global items have been collected.
   */
  private checkGlobalWin(): void {
    const cfg = this.registry.get('gameConfig') as GameConfig;
    const gameState = this.registry.get('gameState') as
      | { collectedIds?: string[] }
      | undefined;
    const collected = gameState?.collectedIds?.length ?? 0;
    if (collected >= cfg.items.length) {
      this.endGame(true);
    }
  }

  /**
   * Called when an item is collected.
   */
  private onItemCollected(item: ItemData): void {
    console.log(`Collected: ${item.name}`);
  }

  /**
   * Updates detection system.
   */
  private updateDetection(): void {
    if (!this.player || !this.itemManager || !this.ui) return;

    const playerPos = this.player.getPosition();

    // Check if any item is in range for magnifier glow
    const detection = this.itemManager.detectInArea(playerPos);
    this.ui.setMagnifierGlow(detection.found);
  }

  update(time: number): void {
    if (this.isPaused) return;

    // Update player
    this.player?.update();

    // Update detection system
    this.updateDetection();

    // Update magnifier glow animation
    this.ui?.updateMagnifierGlow(time);

    // Portal zone check: show/hide travel button
    this.updatePortal();

    // Door zone check: show/hide room-entry button
    this.updateDoor();
  }

  /**
   * Checks whether the player is standing on a Door / Water tile and
   * toggles the room button accordingly. Edge-triggered.
   */
  private updateDoor(): void {
    if (!this.player || !this.tilemap || !this.ui) return;
    if (this.doorTiles.size === 0) return;

    const pos = this.player.getPosition();
    const tile = this.tilemap.worldToTileXY(pos.x, pos.y);
    if (!tile) return;
    const key = `${tile.x},${tile.y}`;
    const door = this.doorTiles.get(key);

    if (door && this.activeDoorKey !== key) {
      this.activeDoorKey = key;
      this.ui.showRoomButton(this, door.label, () => this.openRoom(door.imageKey));
    } else if (!door && this.activeDoorKey !== null) {
      this.activeDoorKey = null;
      this.ui.hideRoomButton();
    }
  }

  /**
   * Pauses gameplay and launches the RoomScene with the given room image.
   * RoomScene resumes us when the player presses its exit button.
   */
  private openRoom(imageKey: string): void {
    if (!this.caseData) return;

    // Persist timeRemaining before pausing so RoomScene can read it
    // (needed if the player collects the final item inside the room and
    // we end the game directly from there).
    const prev = (this.registry.get('gameState') as
      | { timeRemaining?: number; collectedIds?: string[] }
      | undefined) ?? {};
    this.registry.set('gameState', {
      ...prev,
      timeRemaining: this.timeRemaining,
    });

    // Hide the room button before pausing so it isn't lingering visually
    // when we come back (entered state is recomputed in update on resume).
    this.ui?.hideRoomButton();
    this.activeDoorKey = null;

    this.scene.pause();
    this.scene.launch(SceneKeys.Room, {
      caseId: this.caseId,
      roomImageKey: imageKey,
    });
  }

  /**
   * Checks whether the player is standing on a HiddenMove tile and
   * toggles the travel button accordingly.
   */
  private updatePortal(): void {
    if (!this.player || !this.tilemap || !this.ui) return;
    if (this.portalTiles.size === 0) return;

    const pos = this.player.getPosition();
    const tile = this.tilemap.worldToTileXY(pos.x, pos.y);
    if (!tile) return;
    const key = `${tile.x},${tile.y}`;
    const portal = this.portalTiles.get(key);

    if (portal && this.activePortalKey !== key) {
      // Entered a portal tile (or moved from one portal directly to a
      // different one) — show/refresh the travel button for its target.
      this.activePortalKey = key;
      this.activePortalDest = portal.destination;
      this.ui.showTravelButton(this, portal.label);
    } else if (!portal && this.activePortalKey !== null) {
      this.activePortalKey = null;
      this.activePortalDest = null;
      this.ui.hideTravelButton();
    }
  }

  /**
   * Ends the game with win or lose result.
   */
  private endGame(won: boolean): void {
    this.isPaused = true;
    this.timerEvent?.remove();

    // Play appropriate sound
    if (won) {
      this.audio.playWin();
    } else {
      this.audio.playLose();
    }

    // Show game over UI. Items are global now, so count from gameState
    // (includes anything collected in rooms / the other map).
    const cfg = this.registry.get('gameConfig') as GameConfig;
    const gameState = this.registry.get('gameState') as
      | { collectedIds?: string[] }
      | undefined;
    const itemsFound = gameState?.collectedIds?.length ?? 0;
    const totalItems = cfg?.items.length ?? 10;

    this.ui?.showGameOver(this, won, itemsFound, totalItems);

    // Transition to result scene after delay
    this.time.delayedCall(2000, () => {
      this.scene.start(SceneKeys.Result, {
        won,
        itemsFound,
        totalItems,
        timeRemaining: this.timeRemaining,
      });
    });
  }

  /**
   * Cleans up when scene shuts down.
   */
  shutdown(): void {
    this.timerEvent?.remove();
    this.player?.destroy();
    this.itemManager?.destroy();
    this.ui?.destroy();
    this.audio.stopMusic();

    // Tear down the extra UI camera and reset the main camera so a restart
    // (travel) starts from a clean camera state.
    if (this.uiCamera) {
      this.cameras.remove(this.uiCamera);
      this.uiCamera = null;
    }
    this.cameras.main.setZoom(1);
    this.cameras.main.setScroll(0, 0);
  }
}
