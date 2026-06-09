import { Scene } from 'phaser';
import { SceneKeys } from '../types/game.types';
import casesData from '../data/cases.json';

/**
 * BootScene handles all asset loading and initial setup.
 * Displays a loading screen while assets are loaded.
 * Generates placeholder textures for any missing assets.
 */
export class BootScene extends Scene {
  /** Game configuration data loaded from cases.json */
  private casesConfig: Record<string, any> = {};

  constructor() {
    super({ key: SceneKeys.Boot });
  }

  preload(): void {
    // Display loading text
    const loadingText = this.add.text(
      this.scale.width / 2,
      this.scale.height / 2 - 50,
      'Loading...',
      {
        fontFamily: 'GameFont, Arial',
        fontSize: '24px',
        color: '#ffffff',
      }
    );
    loadingText.setOrigin(0.5);

    // Create loading bar background
    const progressBarBg = this.add.rectangle(
      this.scale.width / 2,
      this.scale.height / 2 + 20,
      300,
      30,
      0x2a2a3e
    );
    progressBarBg.setStrokeStyle(2, 0x4a4a6a);

    // Create loading bar
    const progressBar = this.add.rectangle(
      this.scale.width / 2 ,
      this.scale.height / 2 + 20,
      290,
      20,
      0x4a88ff
    );

    // Listen for progress events
    this.load.on('progress', (value: number) => {
      progressBar.width = 290 * value;
    });

    this.load.on('complete', () => {
      progressBar.destroy();
      progressBarBg.destroy();
      loadingText.destroy();
    });

    // Store cases config
    this.casesConfig = casesData;

    // Load Tiled maps + tilesets. Every map lives in its own per-theme
    // subfolder under assets/maps/.
    //
    // Primary: Japan-2 (Kyoto District). Has a HiddenMove portal layer leading
    // to autumn, plus Door1..Door4 layers triggering room views.
    this.load.tilemapTiledJSON('japan-2-map', 'assets/maps/japan/map-japan-2.json');
    this.load.image('tiles-japan', 'assets/tiles/tiles-japan.png');
    // Travel destination: autumn forest. Loaded up-front so portal travel
    // doesn't need a second BootScene pass.
    this.load.tilemapTiledJSON('autumn-map', 'assets/maps/autumn/map-autumn.json');
    this.load.image('autumn-tiles', 'assets/tiles/Autumn_Forest_Tiles.png');
    this.load.image('autumn-objects', 'assets/tiles/Autumn_Forest_Objects.png');

    // Desert (512x384). Tileset embedded manually in the JSON; two images.
    this.load.tilemapTiledJSON('desert-map', 'assets/maps/desert/map-desert.json');
    this.load.image('desert-doodles', 'assets/tiles/tiles-dessert.png');
    this.load.image('desert-tiles', 'assets/tiles/tiles-dessert-2.png');
    this.load.image('room-desert-1', 'assets/maps/desert/room-1.jpg');

    // Castle (992x704), Dungeon (320x208), Island (1856x1024). Each uses a
    // single embedded "spritefusion" tileset → one image apiece.
    this.load.tilemapTiledJSON('castle-map', 'assets/maps/castle/map-castle.json');
    this.load.image('tiles-castle', 'assets/tiles/tiles-castle.png');
    this.load.tilemapTiledJSON('dungeon-map', 'assets/maps/dungeon/map-dungeon.json');
    this.load.image('tiles-dungeon', 'assets/tiles/tiles-dungeon.png');
    this.load.tilemapTiledJSON('island-map', 'assets/maps/island/map-island.json');
    this.load.image('tiles-island', 'assets/tiles/tiles-island.png');

    // Room photos shown when the player enters a Door / Water interaction
    // zone. Native sizes are large (1300-3800 px wide); RoomScene scrolls.
    // Door4's room image hasn't been created yet → it opens a generated
    // "coming soon" placeholder (see createRoomPlaceholderTexture).
    this.load.image('room-japan-balcony', 'assets/maps/japan/balcony.jpg');
    this.load.image('room-japan-living-room', 'assets/maps/japan/living-room.jpg');
    this.load.image('room-japan-shop', 'assets/maps/japan/shop.jpg');
    this.load.image('room-autumn-1', 'assets/maps/autumn/room-1.png');

    // Folder icon for the Case File button (bottom-left evidence UI).
    this.load.image('casefile-folder', 'assets/folder/folder.png');
    // Magnifying-glass icon for the search button (bottom-right).
    this.load.image('magnifier-icon', 'assets/magnifiying-glass.png');

    // Load player animation frames (separate PNGs, side-view only).
    // Frame keys are referenced by the animations created in create().
    this.load.image('player-idle-1', 'assets/player/Idle(1).png');
    this.load.image('player-idle-2', 'assets/player/Idle(2).png');
    this.load.image('player-run-1', 'assets/player/Run(1).png');
    this.load.image('player-run-2', 'assets/player/Run(2).png');
    this.load.image('player-run-3', 'assets/player/Run(3).png');
    this.load.image('player-run-4', 'assets/player/Run(4).png');

    // Load item PNGs declared in cases.json. Failed loads fall back to
    // generated placeholders in create() (see createPlaceholderTextures).
    this.load.on('loaderror', (file: Phaser.Loader.File) => {
      console.warn(`[BootScene] Asset failed to load: ${file.key} (${file.src})`);
    });
    const globalItems = (this.casesConfig.items ?? []) as Array<{
      spriteKey?: string;
      assetPath?: string;
    }>;
    for (const item of globalItems) {
      if (item.assetPath && item.spriteKey) {
        this.load.image(item.spriteKey, `assets/${item.assetPath}`);
      }
    }

    // Audio is optional - try to load but don't fail if missing
    this.load.audio('ambient-japan', 'assets/audio/ambient-japan.mp3');
    this.load.audio('collect-sfx', 'assets/audio/collect-sfx.mp3');
    this.load.audio('detect-sfx', 'assets/audio/detect-sfx.mp3');
    this.load.audio('win-sfx', 'assets/audio/win-sfx.mp3');
    this.load.audio('lose-sfx', 'assets/audio/lose-sfx.mp3');
  }

  create(): void {
    // Generate all placeholder textures
    this.createPlaceholderTextures();

    // Generate the "coming soon" room texture used by Door4 until its real
    // photo is added.
    this.createRoomPlaceholderTexture();

    // Register player animations from the loaded PNG frames.
    this.createPlayerAnimations();

    // Store config in registry for other scenes (items[] + cases{}).
    this.registry.set('gameConfig', this.casesConfig);

    // Wipe any per-game travel state so a fresh boot starts a fresh game.
    this.registry.remove('gameState');

    // Start the game scene
    this.scene.start(SceneKeys.Game);
  }

  /**
   * Registers idle and run animations for the player.
   * Frames are individual image keys loaded in preload().
   */
  private createPlayerAnimations(): void {
    if (!this.anims.exists('player-idle')) {
      this.anims.create({
        key: 'player-idle',
        frames: [
          { key: 'player-idle-1' },
          { key: 'player-idle-2' },
        ],
        frameRate: 3,
        repeat: -1,
      });
    }

    if (!this.anims.exists('player-run')) {
      this.anims.create({
        key: 'player-run',
        frames: [
          { key: 'player-run-1' },
          { key: 'player-run-2' },
          { key: 'player-run-3' },
          { key: 'player-run-4' },
        ],
        frameRate: 10,
        repeat: -1,
      });
    }
  }

  /**
   * Bakes a generic "Room coming soon" placeholder into the texture key
   * 'room-placeholder'. RoomScene renders this like any other room photo
   * (drag-to-pan, edge-clamped) so any door whose real image isn't ready
   * yet (Japan Door4, dungeon, island) still opens cleanly.
   */
  private createRoomPlaceholderTexture(): void {
    const w = 1280;
    const h = 720;
    const key = 'room-placeholder';
    if (this.textures.exists(key)) return;

    const rt = this.make.renderTexture({ width: w, height: h }, false);
    rt.fill(0x14141f, 1);

    const border = this.make.graphics({});
    border.lineStyle(6, 0x3a3a5a, 1);
    border.strokeRect(20, 20, w - 40, h - 40);
    rt.draw(border);
    border.destroy();

    const title = this.make.text(
      {
        x: w / 2,
        y: h / 2 - 24,
        text: 'Room coming soon',
        style: { fontFamily: 'GameFont, Arial', fontSize: '48px', color: '#8888aa' },
      },
      false
    );
    title.setOrigin(0.5);
    rt.draw(title, w / 2, h / 2 - 24);
    title.destroy();

    rt.saveTexture(key);
    rt.destroy();
  }

  /**
   * Creates placeholder textures for all assets.
   * This ensures the game can run even without art assets.
   */
  private createPlaceholderTextures(): void {
    const graphics = this.make.graphics({});

    // ========================================================================
    // Tile textures (for the map)
    // ========================================================================

    // Floor tile (tatami mat style)
    graphics.clear();
    graphics.fillStyle(0x3a3a4e, 1);
    graphics.fillRect(0, 0, 32, 32);
    // Add tatami line pattern
    graphics.lineStyle(1, 0x4a4a5e, 0.5);
    graphics.strokeRect(2, 2, 28, 28);
    graphics.lineStyle(1, 0x4a4a5e, 0.3);
    for (let i = 4; i < 32; i += 8) {
      graphics.moveTo(i, 4);
      graphics.lineTo(i, 28);
    }
    graphics.strokePath();
    graphics.generateTexture('japan-tiles', 32, 32);

    // Wall tile
    graphics.clear();
    graphics.fillStyle(0x2a2a3e, 1);
    graphics.fillRect(0, 0, 32, 32);
    graphics.lineStyle(2, 0x3a3a4e);
    graphics.strokeRect(0, 0, 32, 32);
    graphics.generateTexture('wall-tile', 32, 32);

    // ========================================================================
    // Item sprites — generate a simple placeholder ONLY for items whose PNG
    // failed to load (or that have no assetPath). Real PNGs always win.
    // ========================================================================
    const placeholderPalette = [
      0xff6b6b, 0xc0c0c0, 0x4ecdc4, 0xff6b9d, 0xffeead,
      0xd4a574, 0xffd700, 0x96ceb4, 0xcd7f32, 0x8b4513,
    ];
    let paletteIndex = 0;
    const placeholderItems = (this.casesConfig.items ?? []) as Array<{ spriteKey?: string }>;
    for (const item of placeholderItems) {
      const key = item.spriteKey;
      if (!key || this.textures.exists(key)) {
        paletteIndex++;
        continue;
      }
      const color = placeholderPalette[paletteIndex % placeholderPalette.length];
      paletteIndex++;
      graphics.clear();
      // Solid colored disc with a darker ring — clearly a placeholder.
      graphics.fillStyle(color, 1);
      graphics.fillCircle(12, 12, 10);
      graphics.lineStyle(2, 0x000000, 0.6);
      graphics.strokeCircle(12, 12, 10);
      // First letter of the id, drawn as a small dark square so it's
      // visually distinct without needing a font baked in.
      graphics.fillStyle(0x000000, 0.7);
      graphics.fillRect(10, 10, 4, 4);
      graphics.generateTexture(key, 24, 24);
    }

    // ========================================================================
    // UI elements
    // ========================================================================

    // Magnifier button
    graphics.clear();
    graphics.fillStyle(0x4a4a6a, 1);
    graphics.fillCircle(40, 40, 38);
    graphics.lineStyle(3, 0x6a6a8a);
    graphics.strokeCircle(40, 40, 38);
    // Glass
    graphics.fillStyle(0x88ccff, 0.7);
    graphics.fillCircle(35, 35, 22);
    graphics.lineStyle(2, 0xaaddff);
    graphics.strokeCircle(35, 35, 22);
    // Handle
    graphics.fillStyle(0x6a5a4a, 1);
    graphics.fillRect(50, 50, 10, 18);
    graphics.generateTexture('magnifier-btn', 80, 80);

    // Panel background (seamless tileable)
    graphics.clear();
    graphics.fillStyle(0x1a1a2e, 0.95);
    graphics.fillRect(0, 0, 32, 32);
    graphics.lineStyle(1, 0x2a2a3e);
    graphics.strokeRect(0, 0, 32, 32);
    graphics.generateTexture('panel-bg', 32, 32);

    // Checkmark
    graphics.clear();
    graphics.lineStyle(4, 0x00ff00);
    graphics.moveTo(4, 12);
    graphics.lineTo(10, 18);
    graphics.lineTo(20, 6);
    graphics.strokePath();
    graphics.generateTexture('checkmark', 24, 24);

    graphics.destroy();
  }
}
