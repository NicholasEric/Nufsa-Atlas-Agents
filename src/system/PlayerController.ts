import { PlayerState, PlayerConfig } from '../types/game.types';

/**
 * PlayerController handles all player character functionality.
 * Manages movement, input (keyboard + touch), collision, and facing direction.
 */
export class PlayerController {
  /** The player sprite */
  public sprite: Phaser.GameObjects.Sprite;

  /** Current player state */
  public state: PlayerState;

  /** Input cursors for keyboard controls */
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys;

  /** Virtual joystick for touch controls */
  private joystickZone: Phaser.GameObjects.Zone | null = null;
  /** Visual joystick ring (screen-space; kept on the UI camera). */
  private joystickBase: Phaser.GameObjects.Graphics | null = null;
  private joystickOrigin: Phaser.Math.Vector2 | null = null;
  private joystickCurrent: Phaser.Math.Vector2 | null = null;
  private joystickActive: boolean = false;


  /** Callback when player collects something */
  public onItemCollected?: () => void;

  /** Map bounds (px) the player is clamped within. Set from config. */
  private mapWidth: number;
  private mapHeight: number;

  constructor(scene: Phaser.Scene, config: PlayerConfig) {
    this.mapWidth = config.mapWidth ?? 1024;
    this.mapHeight = config.mapHeight ?? 768;

    // Create player sprite. Source PNGs are 112x128 with ~15px of
    // transparent padding BELOW the visible feet. Anchoring the origin
    // to the visible feet (texture y=112) — instead of the PNG bottom —
    // keeps door/portal triggers and collisions aligned with what the
    // player sees on screen.
    const PNG_H = 128;
    const VISIBLE_FEET_Y = 120; // bottom row of non-transparent pixels

    this.sprite = scene.add.sprite(config.startX, config.startingY, config.spriteKey);
    this.sprite.setDepth(0); // Render above tiles
    this.sprite.setOrigin(0.5, VISIBLE_FEET_Y / PNG_H);
    // Source PNGs are 112x128; scale down. Default 0.3 is tuned for
    // 32px-tile maps; GameScene overrides per map so the player stays
    // ~1 tile tall regardless of the map's tile size.
    this.sprite.setScale(config.scale ?? 0.3);

    // Start the idle animation immediately so the sprite isn't a static frame.
    this.sprite.anims.play('player-idle', true);

    // Initialize state
    this.state = {
      isMoving: false,
      facingDirection: 'down',
      speed: config.speed,
    };

    // Setup keyboard input
    this.cursors = scene.input.keyboard!.createCursorKeys();

    // Setup touch joystick for touch input
    this.setupTouchJoystick(scene);

    // Enable physics on sprite. Body is a small box at the visible feet
    // (NOT the PNG bottom), so collisions land where the player sees them.
    scene.physics.add.existing(this.sprite);
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    //const bodyW = 20;
    //const bodyH = 16;
    const bodyW = 96;
    const bodyH = 96;
    body.setSize(bodyW, bodyH);
    // Body bottom aligned with visible feet → body top is bodyH above feet.
    body.setOffset((this.sprite.width - bodyW) / 2, VISIBLE_FEET_Y - bodyH);
  }

  /**
   * Sets up the virtual joystick for touch input.
   * The joystick appears where the player first touches the left side of screen.
   */
  private setupTouchJoystick(scene: Phaser.Scene): void {
    // Create invisible zone covering left half of screen for joystick input
    const zoneWidth = scene.scale.width * 0.5;
    const zoneHeight = scene.scale.height;

    this.joystickZone = scene.add.zone(zoneWidth / 2, zoneHeight / 2, zoneWidth, zoneHeight);
    this.joystickZone.setInteractive();
    this.joystickZone.setDepth(100); // Above everything

    // Visual indicator for joystick (subtle circle)
    const joystickBase = scene.add.graphics();
    joystickBase.lineStyle(2, 0xffffff, 0.3);
    joystickBase.strokeCircle(0, 0, 50);
    joystickBase.setDepth(99);
    joystickBase.setScrollFactor(0);
    joystickBase.setAlpha(0); // Hidden until touch
    this.joystickBase = joystickBase;

    // Touch start - initialize joystick position
    scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.x <= zoneWidth) {
        this.joystickActive = true;
        this.joystickOrigin = new Phaser.Math.Vector2(pointer.x, pointer.y);
        this.joystickCurrent = new Phaser.Math.Vector2(pointer.x, pointer.y);

        // Move visual indicator to touch position
        joystickBase.setPosition(pointer.x, pointer.y);
        joystickBase.setAlpha(0.5);
        joystickBase.clear();
        joystickBase.lineStyle(2, 0xffffff, 0.5);
        joystickBase.strokeCircle(0, 0, 50);
      }
    });

    // Touch move - update joystick direction
    scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.joystickActive && pointer.isDown && pointer.x <= zoneWidth) {
        this.joystickCurrent = new Phaser.Math.Vector2(pointer.x, pointer.y);
      }
    });

    // Touch end - reset joystick
    scene.input.on('pointerup', () => {
      this.joystickActive = false;
      this.joystickOrigin = null;
      this.joystickCurrent = null;
      joystickBase.setAlpha(0);
    });
  }

  /**
   * Gets the input direction from keyboard and touch.
   * Returns a normalized vector.
   */
  private getInputDirection(): Phaser.Math.Vector2 {
    const keyboardDir = new Phaser.Math.Vector2(0, 0);
    const touchDir = new Phaser.Math.Vector2(0, 0);

    // Keyboard input
    if (this.cursors.left.isDown) keyboardDir.x -= 1;
    if (this.cursors.right.isDown) keyboardDir.x += 1;
    if (this.cursors.up.isDown) keyboardDir.y -= 1;
    if (this.cursors.down.isDown) keyboardDir.y += 1;

    // Touch joystick input
    if (this.joystickActive && this.joystickOrigin && this.joystickCurrent) {
      const diff = new Phaser.Math.Vector2(
        this.joystickCurrent.x - this.joystickOrigin.x,
        this.joystickCurrent.y - this.joystickOrigin.y
      );

      // Clamp to max radius of 50 pixels
      const distance = diff.length();
      if (distance > 50) {
        diff.scale(50 / distance);
      }

      // Normalize to -1 to 1 range (50px = full input)
      touchDir.x = diff.x / 50;
      touchDir.y = diff.y / 50;
    }

    // Combine inputs (touch takes priority if active)
    if (this.joystickActive && touchDir.length() > 0.1) {
      return touchDir;
    }

    // Normalize keyboard input (prevent faster diagonal movement)
    if (keyboardDir.length() > 1) {
      keyboardDir.normalize();
    }

    return keyboardDir;
  }

  /**
   * Updates the facing direction based on movement.
   */
  private updateFacingDirection(direction: Phaser.Math.Vector2): void {
    if (direction.length() < 0.1) return;

    const absX = Math.abs(direction.x);
    const absY = Math.abs(direction.y);

    // Determine primary axis
    if (absX > absY) {
      // Horizontal movement
      this.state.facingDirection = direction.x > 0 ? 'right' : 'left';
    } else {
      // Vertical movement
      this.state.facingDirection = direction.y > 0 ? 'down' : 'up';
    }

    // Flip sprite based on direction
    if (this.state.facingDirection === 'left') {
      this.sprite.setFlipX(true);
    } else if (this.state.facingDirection === 'right') {
      this.sprite.setFlipX(false);
    }
  }

  /**
   * Main update loop - called every frame.
   */
  public update(): void {
    const inputDir = this.getInputDirection();
    this.state.isMoving = inputDir.length() > 0.1;

    if (this.state.isMoving) {
      // Update facing direction
      this.updateFacingDirection(inputDir);

      // Calculate velocity
      const velocity = new Phaser.Math.Vector2(
        inputDir.x * this.state.speed,
        inputDir.y * this.state.speed
      );

      // Apply movement
      const body = this.sprite.body as Phaser.Physics.Arcade.Body;
      body.setVelocity(velocity.x, velocity.y);

      this.sprite.anims.play('player-run', true);
    } else {
      // Stop moving
      const body = this.sprite.body as Phaser.Physics.Arcade.Body;
      body.setVelocity(0, 0);

      this.sprite.anims.play('player-idle', true);
    }

    // Keep player within the current map's pixel bounds.
    const bounds = {
      x: Phaser.Math.Clamp(this.sprite.x, 0, this.mapWidth),
      y: Phaser.Math.Clamp(this.sprite.y, 0, this.mapHeight),
    };
    this.sprite.setPosition(bounds.x, bounds.y);
  }

  /**
   * Gets the position 3 tiles (96 pixels) in front of the player.
   * Used for detection cone origin.
   */
  public getDetectionOrigin(): Phaser.Math.Vector2 {
    const distance = 96; // 3 tiles of 32px
    const origin = new Phaser.Math.Vector2(this.sprite.x, this.sprite.y);

    switch (this.state.facingDirection) {
      case 'up':
        origin.y -= distance;
        break;
      case 'down':
        origin.y += distance;
        break;
      case 'left':
        origin.x -= distance;
        break;
      case 'right':
        origin.x += distance;
        break;
    }

    return origin;
  }

  /**
   * Gets the facing angle in radians for detection cone calculation.
   */
  public getFacingAngle(): number {
    switch (this.state.facingDirection) {
      case 'up':
        return -Math.PI / 2;
      case 'down':
        return Math.PI / 2;
      case 'left':
        return Math.PI;
      case 'right':
        return 0;
    }
  }

  /**
   * Returns the player's current position.
   */
  public getPosition(): Phaser.Math.Vector2 {
    return new Phaser.Math.Vector2(this.sprite.x, this.sprite.y);
  }

  /**
   * Screen-space (HUD) objects owned by the player — currently the touch
   * joystick ring. GameScene keeps these on the un-zoomed UI camera.
   */
  public getScreenSpaceObjects(): Phaser.GameObjects.GameObject[] {
    return this.joystickBase ? [this.joystickBase] : [];
  }

  /**
   * Destroys the player controller and cleans up resources.
   */
  public destroy(): void {
    this.sprite.destroy();
    this.joystickZone?.destroy();
  }
}
