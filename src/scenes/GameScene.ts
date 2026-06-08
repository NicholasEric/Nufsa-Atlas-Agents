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

  /** Current case ID (e.g., "japan-2", "autumn"). */
  private caseId: string = 'japan-2';

  /** Tile coords ("col,row") that count as portal zones for this map. */
  private portalTiles: Set<string> = new Set();

  /** Whether the player is currently standing on a portal tile. */
  private inPortal: boolean = false;

  /** Tile coords ("col,row") → door config for room-view interactions. */
  private doorTiles: Map<string, { imageKey: string; label: string }> = new Map();

  /** Currently-active door key ("col,row"), or null if not on a door tile. */
  private activeDoorKey: string | null = null;

  constructor() {
    super({ key: SceneKeys.Game });
  }

  create(data?: { caseId?: string }): void {
    // Initialize audio manager with this scene
    this.audio.init(this);

    // Pick which case to load. Defaults to japan-2 (the entry map).
    this.caseId = data?.caseId ?? 'japan-2';

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
        // 'room-japan-placeholder' texture (no items live here yet).
        { layerName: 'Door4', imageKey: 'room-japan-placeholder', label: 'Locked Room' },
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
  };

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

    this.tilemap = this.make.tilemap({ key: cfg.tilemapKey });

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
      if (layer) layer.setDepth(depth);
    }

    // Collision layer: invisible, every non-empty tile blocks movement.
    this.collisionLayer = this.tilemap.createLayer('Collision', sets, 0, 0);
    if (this.collisionLayer) {
      this.collisionLayer.setVisible(false);
      this.collisionLayer.setCollisionByExclusion([-1, 0]);
    }

    // HiddenMove layer: invisible portal trigger. Parse its filled tiles
    // into a Set<"col,row"> for fast per-frame lookup. The layer itself is
    // not rendered.
    this.portalTiles = this.parseHiddenMoveTiles();

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
   * Reads the HiddenMove layer (if present) from the underlying map JSON
   * and returns the set of "col,row" coords containing a non-zero tile.
   * Hides the rendered layer so the trigger tiles aren't visible to the
   * player.
   */
  private parseHiddenMoveTiles(): Set<string> {
    const result = new Set<string>();
    if (!this.tilemap) return result;
    const layerData = this.tilemap.getLayer('HiddenMove');
    if (!layerData) return result;

    for (let row = 0; row < layerData.height; row++) {
      for (let col = 0; col < layerData.width; col++) {
        const tile = layerData.data[row][col];
        if (tile && tile.index > 0) result.add(`${col},${row}`);
      }
    }

    // Render the actual layer invisibly so it exists but doesn't show.
    const renderedLayer = this.tilemap.createLayer('HiddenMove', this.tilemap.tilesets, 0, 0);
    if (renderedLayer) renderedLayer.setVisible(false);

    return result;
  }

  /**
   * Creates the player character.
   */
  private createPlayer(): void {
    this.player = new PlayerController(this, {
      startX: 300,
      startingY: 300,
      speed: 150,
      spriteKey: 'player-idle-1',
    });

    // Add collision with tilemap collision layer
    if (this.collisionLayer) {
      this.physics.add.collider(this.player.sprite, this.collisionLayer);
    }
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
    if (!this.caseData?.portalDestination) return;
    const dest = this.caseData.portalDestination;

    // Carry remaining time forward; collectedIds is already maintained
    // globally via recordCollected(), nothing to merge per-case.
    const prev = (this.registry.get('gameState') as
      | { timeRemaining?: number; collectedIds?: string[] }
      | undefined) ?? {};
    this.registry.set('gameState', {
      ...prev,
      timeRemaining: this.timeRemaining,
    });

    this.scene.restart({ caseId: dest });
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
    if (!this.player || !this.tilemap || !this.ui || !this.caseData) return;
    if (!this.caseData.portalDestination || this.portalTiles.size === 0) return;

    const pos = this.player.getPosition();
    const tile = this.tilemap.worldToTileXY(pos.x, pos.y);
    if (!tile) return;
    const isInside = this.portalTiles.has(`${tile.x},${tile.y}`);

    if (isInside && !this.inPortal) {
      this.inPortal = true;
      const cfg = this.registry.get('gameConfig') as GameConfig;
      const destLocation = cfg.cases[this.caseData.portalDestination]?.location ?? this.caseData.portalDestination;
      this.ui.showTravelButton(this, `→ Travel to ${destLocation}`);
    } else if (!isInside && this.inPortal) {
      this.inPortal = false;
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
  }
}
