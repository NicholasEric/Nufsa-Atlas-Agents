import { ItemData, DetectionResult, DetectionConfig } from '../types/game.types';

/**
 * ItemManager handles all item-related functionality.
 * Spawns items, handles detection logic, and manages collection.
 */
export class ItemManager {
  /** All items for the current case */
  private items: ItemData[];

  /** Sprite references for uncollected items */
  private itemSprites: Map<string, Phaser.GameObjects.Sprite> = new Map();

  /** Graphics for debug visualization */
  private debugGraphics: Phaser.GameObjects.Graphics | null = null;

  /** Detection configuration */
  private config: DetectionConfig = {
    range: 128, // 4 tiles
    coneAngle: 45, // 45 degrees in front
  };

  /** Callback when an item is collected */
  public onItemCollected?: (item: ItemData) => void;

  /** Callback when detection finds an item */
  public onItemDetected?: (item: ItemData) => void;

  constructor(scene: Phaser.Scene, items: ItemData[]) {
    this.items = items;
    this.spawnItems(scene);
  }

  /**
   * Spawns all items at their configured positions.
   * Items are scaled down and slightly hidden to make them harder to spot.
   */
  private spawnItems(scene: Phaser.Scene): void {
    for (const item of this.items) {
      if (item.collected) continue;

      // Create item sprite (location.x/y are world pixels for map items).
      const sprite = scene.add.sprite(item.location.x, item.location.y, item.spriteKey);
      sprite.setDepth(5); // Above tiles, below player
      // Normalize on-screen size so PNGs of different native sizes
      // (e.g., 24/32/64 px) all render at roughly one tile.
      const targetSize = 28;
      const naturalSize = Math.max(sprite.width, sprite.height) || targetSize;
      sprite.setScale(targetSize / naturalSize);
      sprite.setAlpha(0.9);
      sprite.setAngle(Phaser.Math.Between(-15, 15)); // Slight random rotation
      sprite.setVisible(true); // Visible for player to find

      // Store reference
      this.itemSprites.set(item.id, sprite);
    }
  }

  /**
   * Returns the live item sprites (world objects). Used by GameScene to
   * assign them to the zoomed world camera.
   */
  public getSprites(): Phaser.GameObjects.Sprite[] {
    return [...this.itemSprites.values()];
  }

  /**
   * Enables debug visualization for detection cone.
   */
  public enableDebug(scene: Phaser.Scene): void {
    this.debugGraphics = scene.add.graphics();
    this.debugGraphics.setDepth(100);
  }

  /**
   * Draws the detection cone for debugging.
   */
  public drawDetectionCone(origin: Phaser.Math.Vector2, angle: number): void {
    if (!this.debugGraphics) return;

    this.debugGraphics.clear();
    this.debugGraphics.lineStyle(2, 0x00ff00, 0.7);
    this.debugGraphics.fillStyle(0x00ff00, 0.1);

    const coneAngleRad = Phaser.Math.DegToRad(this.config.coneAngle);
    const startAngle = angle - coneAngleRad / 2;
    const endAngle = angle + coneAngleRad / 2;

    // Draw cone wedge
    this.debugGraphics.beginPath();
    this.debugGraphics.moveTo(origin.x, origin.y);
    this.debugGraphics.arc(origin.x, origin.y, this.config.range, startAngle, endAngle);
    this.debugGraphics.closePath();
    this.debugGraphics.strokePath();
    this.debugGraphics.fillPath();
  }

  /**
   * Clears the debug graphics.
   */
  public clearDebug(): void {
    this.debugGraphics?.clear();
  }

  /**
   * Detects items in a 3x3 tile area centered on the player.
   * The center tile is the player's tile; items in any of the 8 surrounding
   * tiles also count. Returns the closest uncollected item, if any.
   */
  public detectInArea(playerPos: Phaser.Math.Vector2): DetectionResult {
    const result: DetectionResult = {
      found: false,
      item: null,
      distance: Infinity,
    };

    // Tile size used for the conceptual 3x3 box (independent of the
    // actual map's tile size — this is the gameplay reach knob).
    const tileSize = 32;
    const halfBox = (tileSize * 3) / 2; // ±48 px from player center

    for (const item of this.items) {
      if (item.collected) continue;

      const dx = item.location.x - playerPos.x;
      const dy = item.location.y - playerPos.y;

      if (Math.abs(dx) > halfBox || Math.abs(dy) > halfBox) continue;

      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < result.distance) {
        result.found = true;
        result.item = item;
        result.distance = distance;
      }
    }

    return result;
  }

  /**
   * Collects an item, removing it from the scene.
   * Plays collection animation if provided.
   */
  public collect(
    scene: Phaser.Scene,
    item: ItemData,
    onComplete?: () => void
  ): void {
    const sprite = this.itemSprites.get(item.id);
    if (!sprite) {
      onComplete?.();
      return;
    }

    // Mark as collected
    item.collected = true;

    // Collection animation: scale up and fade out
    scene.tweens.add({
      targets: sprite,
      scale: sprite.scale * 1.5,
      alpha: 0,
      duration: 300,
      ease: 'Power2',
      onComplete: () => {
        sprite.destroy();
        this.itemSprites.delete(item.id);
        onComplete?.();
      },
    });

    // Notify listeners
    this.onItemCollected?.(item);
  }

  /**
   * Checks if a specific item is still available.
   */
  public isItemCollected(itemId: string): boolean {
    const item = this.items.find(i => i.id === itemId);
    return item?.collected ?? true;
  }

  /**
   * Returns all items (collected and uncollected).
   */
  public getAllItems(): ItemData[] {
    return this.items;
  }

  /**
   * Returns only uncollected items.
   */
  public getUncollectedItems(): ItemData[] {
    return this.items.filter(item => !item.collected);
  }

  /**
   * Returns the count of collected items.
   */
  public getCollectedCount(): number {
    return this.items.filter(item => item.collected).length;
  }

  /**
   * Checks if all items have been collected.
   */
  public allItemsCollected(): boolean {
    return this.getCollectedCount() >= this.items.length;
  }

  /**
   * Makes an item sprite visible (for hint system).
   */
  public revealItem(itemId: string, scene: Phaser.Scene): void {
    const sprite = this.itemSprites.get(itemId);
    if (sprite && !sprite.visible) {
      // Pulse animation to draw attention
      sprite.setVisible(true);
      scene.tweens.add({
        targets: sprite,
        alpha: 1,
        scale: 0.8,
        duration: 200,
        yoyo: true,
        repeat: 2,
        onComplete: () => {
          sprite.setAlpha(0.8);
          sprite.setScale(0.6);
        },
      });
    }
  }

  /**
   * Destroys the item manager and cleans up resources.
   */
  public destroy(): void {
    this.itemSprites.forEach(sprite => sprite.destroy());
    this.itemSprites.clear();
    this.debugGraphics?.destroy();
  }
}
