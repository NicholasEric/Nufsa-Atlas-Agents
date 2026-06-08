import { ItemData } from '../types/game.types';
import { EvidenceBar } from './EvidenceBar';

/**
 * UIManager handles all UI components.
 * Timer, magnifier button, travel/room buttons, and the FOUND popup.
 * The bottom evidence bar (+ its description modal) is delegated to the
 * shared EvidenceBar component so it matches RoomScene exactly.
 */
export class UIManager {
  /** Container for all UI elements */
  private uiContainer: Phaser.GameObjects.Container;

  /** Timer display */
  private timerText: Phaser.GameObjects.Text | null = null;

  /** Shared bottom evidence bar (built in populateItemList). */
  private evidenceBar: EvidenceBar | null = null;

  /** Magnifier button */
  private magnifierBtn: Phaser.GameObjects.Container | null = null;
  private magnifierGlow: Phaser.GameObjects.Graphics | null = null;

  /** Callback when magnifier is pressed */
  public onMagnifierPressed?: () => void;

  /** Callback when modal is shown/hidden (for pause control) */
  public onModalStateChanged?: (isOpen: boolean) => void;

  /** Callback when the travel (portal) button is pressed */
  public onTravelPressed?: () => void;

  /** Travel button (shown when player is on a HiddenMove tile) */
  private travelBtnContainer: Phaser.GameObjects.Container | null = null;
  private travelBtnLabel: Phaser.GameObjects.Text | null = null;

  /** Room button (shown when player is on a Door / Water tile) */
  private roomBtnContainer: Phaser.GameObjects.Container | null = null;
  private roomBtnLabel: Phaser.GameObjects.Text | null = null;

  /** Whether the magnifier should glow (item in range) */
  private shouldGlow: boolean = false;

  constructor(scene: Phaser.Scene) {
    // Create main UI container (fixed to camera)
    this.uiContainer = scene.add.container(0, 0);
    this.uiContainer.setDepth(1000);
    this.uiContainer.setScrollFactor(0);

    this.createTimer(scene);
    this.createMagnifierButton(scene);
  }

  /**
   * Creates the countdown timer at top-center.
   */
  private createTimer(scene: Phaser.Scene): void {
    const screenWidth = scene.scale.width;

    this.timerText = scene.add.text(screenWidth / 2, 20, '5:00', {
      fontFamily: 'GameFont, Arial',
      fontSize: '32px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4,
      fontStyle: 'bold',
    });
    this.timerText.setOrigin(0.5, 0);
    this.timerText.setScrollFactor(0);

    this.uiContainer.add(this.timerText);
  }

  /**
   * Builds the shared bottom evidence bar. Call once after construction.
   * Items already flagged `collected` start ticked. Tapping a slot opens
   * the description modal, which pauses the game via onModalStateChanged
   * (read lazily so it works even if the callback is wired up later).
   */
  public populateItemList(scene: Phaser.Scene, items: ItemData[]): void {
    this.evidenceBar?.destroy();
    const collectedIds = items.filter(it => it.collected).map(it => it.id);
    this.evidenceBar = new EvidenceBar(scene, items, collectedIds, {
      onModalStateChanged: open => this.onModalStateChanged?.(open),
    });
  }

  /**
   * Creates the magnifier button at bottom-right.
   */
  private createMagnifierButton(scene: Phaser.Scene): void {
    const screenWidth = scene.scale.width;
    const screenHeight = scene.scale.height;
    const btnSize = 80;
    const padding = 20;

    const btnX = screenWidth - padding - btnSize / 2;
    const btnY = screenHeight - padding - btnSize / 2 - 50; // Above item panel

    // Glow effect (behind button)
    this.magnifierGlow = scene.add.graphics();
    this.magnifierGlow.setDepth(998);
    this.magnifierGlow.setScrollFactor(0);

    // Button background circle - this is the interactive visual element
    const btnBg = scene.add.circle(btnX, btnY, btnSize / 2, 0x4a4a6a);
    btnBg.setStrokeStyle(3, 0x8888aa);
    btnBg.setDepth(999);
    btnBg.setScrollFactor(0);
    btnBg.setInteractive({ useHandCursor: true });

    // Magnifier icon (simple circle with handle)
    const iconGroup = scene.add.container(btnX, btnY);

    // Glass part
    const glass = scene.add.circle(0, 0, 25, 0x88ccff, 0.6);
    glass.setStrokeStyle(4, 0xaaddff);

    // Handle
    const handle = scene.add.rectangle(18, 18, 8, 25, 0x8888aa);
    handle.setRotation(Math.PI / 4);

    iconGroup.add([glass, handle]);
    iconGroup.setDepth(1000);
    iconGroup.setScrollFactor(0);

    // Track magnifier as the visual circle (used for glow positioning)
    this.magnifierBtn = iconGroup;

    // Press animation - tween the icon group for visual feedback
    btnBg.on('pointerdown', () => {
      scene.tweens.add({
        targets: [btnBg, iconGroup],
        scale: 0.9,
        duration: 100,
        yoyo: true,
      });
      this.onMagnifierPressed?.();
    });

    // Hover effect
    btnBg.on('pointerover', () => {
      btnBg.setStrokeStyle(3, 0xaabbcc);
    });
    btnBg.on('pointerout', () => {
      btnBg.setStrokeStyle(3, 0x8888aa);
    });

    this.uiContainer.add([this.magnifierGlow, btnBg, iconGroup]);
  }

  /**
   * Sets whether the magnifier button should glow.
   */
  public setMagnifierGlow(enabled: boolean): void {
    this.shouldGlow = enabled;
  }

  /**
   * Updates the magnifier glow effect.
   * Call every frame.
   */
  public updateMagnifierGlow(time: number): void {
    if (!this.magnifierGlow || !this.magnifierBtn) return;

    if (this.shouldGlow) {
      this.magnifierGlow.clear();
      // Bright pulsing glow when item is in range
      const glowIntensity = 0.4 + Math.sin(time / 150) * 0.2;
      this.magnifierGlow.fillStyle(0x00ff00, glowIntensity);
      this.magnifierGlow.fillCircle(this.magnifierBtn.x, this.magnifierBtn.y, 55);

      // Second glow layer for extra effect
      this.magnifierGlow.fillStyle(0x00ff00, glowIntensity * 0.5);
      this.magnifierGlow.fillCircle(this.magnifierBtn.x, this.magnifierBtn.y, 70);
    } else {
      this.magnifierGlow.clear();
    }
  }

  /**
   * Updates an item slot's collected state on the evidence bar.
   */
  public updateItemEntry(itemId: string, collected: boolean): void {
    this.evidenceBar?.setCollected(itemId, collected);
  }

  /**
   * Updates the timer display.
   */
  public updateTimer(seconds: number): void {
    if (!this.timerText) return;

    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;

    this.timerText.setText(timeStr);

    // Warning color when under 30 seconds
    if (seconds < 30) {
      this.timerText.setColor('#ff4444');
    } else if (seconds < 60) {
      this.timerText.setColor('#ffaa00');
    } else {
      this.timerText.setColor('#ffffff');
    }
  }

  /**
   * Shows the travel button at the top-center of the screen with the
   * given label. Idempotent — calling again with a different label just
   * updates the text. The button stays visible until hideTravelButton().
   */
  public showTravelButton(scene: Phaser.Scene, label: string): void {
    if (this.travelBtnContainer && this.travelBtnLabel) {
      // Already shown — just refresh the label.
      this.travelBtnLabel.setText(label);
      return;
    }

    const screenWidth = scene.scale.width;
    const btnY = 70; // Below the timer at the top.
    const padX = 20;
    const padY = 12;

    const text = scene.add.text(0, 0, label, {
      fontFamily: 'GameFont, Arial',
      fontSize: '22px',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
    });
    text.setOrigin(0.5);

    const bgWidth = text.width + padX * 2;
    const bgHeight = text.height + padY * 2;
    const bg = scene.add.rectangle(0, 0, bgWidth, bgHeight, 0x4a3a2a, 0.95);
    bg.setStrokeStyle(3, 0xffd700);
    bg.setInteractive({ useHandCursor: true });

    bg.on('pointerdown', () => {
      // Quick squash for tactile feedback, then fire the callback.
      scene.tweens.add({
        targets: this.travelBtnContainer,
        scale: 0.92,
        duration: 80,
        yoyo: true,
        onComplete: () => this.onTravelPressed?.(),
      });
    });
    bg.on('pointerover', () => bg.setStrokeStyle(3, 0xffffff));
    bg.on('pointerout', () => bg.setStrokeStyle(3, 0xffd700));

    const container = scene.add.container(screenWidth / 2, btnY, [bg, text]);
    container.setScrollFactor(0);
    container.setDepth(1500);

    // Slide-down + fade in.
    container.setAlpha(0);
    container.y = btnY - 20;
    scene.tweens.add({
      targets: container,
      alpha: 1,
      y: btnY,
      duration: 200,
      ease: 'Cubic.easeOut',
    });

    this.travelBtnContainer = container;
    this.travelBtnLabel = text;
    this.uiContainer.add(container);
  }

  /**
   * Hides and destroys the travel button (with a quick fade-out).
   */
  public hideTravelButton(): void {
    if (!this.travelBtnContainer) return;
    const container = this.travelBtnContainer;
    this.travelBtnContainer = null;
    this.travelBtnLabel = null;
    container.scene.tweens.add({
      targets: container,
      alpha: 0,
      y: container.y - 20,
      duration: 150,
      onComplete: () => container.destroy(),
    });
  }

  /**
   * Shows the room-entry button at the top-center, mirroring the travel
   * button's visual style. Takes a per-call callback (action varies per
   * door). Idempotent — calling again with a different label/callback
   * just refreshes both.
   */
  public showRoomButton(scene: Phaser.Scene, label: string, onClick: () => void): void {
    if (this.roomBtnContainer && this.roomBtnLabel) {
      this.roomBtnLabel.setText(label);
      // Re-bind the click handler. Easiest: tear down and recreate the bg.
      const bg = this.roomBtnContainer.getAt(0) as Phaser.GameObjects.Rectangle;
      if (bg) {
        bg.removeAllListeners('pointerdown');
        bg.on('pointerdown', () => onClick());
      }
      return;
    }

    const screenWidth = scene.scale.width;
    const btnY = 70; // Same slot as travel button (mutually exclusive in practice).
    const padX = 20;
    const padY = 12;

    const text = scene.add.text(0, 0, label, {
      fontFamily: 'GameFont, Arial',
      fontSize: '22px',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
    });
    text.setOrigin(0.5);

    const bgWidth = text.width + padX * 2;
    const bgHeight = text.height + padY * 2;
    const bg = scene.add.rectangle(0, 0, bgWidth, bgHeight, 0x2a3a5a, 0.95);
    bg.setStrokeStyle(3, 0x88ccff);
    bg.setInteractive({ useHandCursor: true });

    bg.on('pointerdown', () => {
      scene.tweens.add({
        targets: this.roomBtnContainer,
        scale: 0.92,
        duration: 80,
        yoyo: true,
        onComplete: () => onClick(),
      });
    });
    bg.on('pointerover', () => bg.setStrokeStyle(3, 0xffffff));
    bg.on('pointerout', () => bg.setStrokeStyle(3, 0x88ccff));

    const container = scene.add.container(screenWidth / 2, btnY, [bg, text]);
    container.setScrollFactor(0);
    container.setDepth(1500);

    container.setAlpha(0);
    container.y = btnY - 20;
    scene.tweens.add({
      targets: container,
      alpha: 1,
      y: btnY,
      duration: 200,
      ease: 'Cubic.easeOut',
    });

    this.roomBtnContainer = container;
    this.roomBtnLabel = text;
    this.uiContainer.add(container);
  }

  /**
   * Hides and destroys the room button.
   */
  public hideRoomButton(): void {
    if (!this.roomBtnContainer) return;
    const container = this.roomBtnContainer;
    this.roomBtnContainer = null;
    this.roomBtnLabel = null;
    container.scene.tweens.add({
      targets: container,
      alpha: 0,
      y: container.y - 20,
      duration: 150,
      onComplete: () => container.destroy(),
    });
  }

  /**
   * Instance wrapper: shows the popup AND pauses gameplay (via the
   * onModalStateChanged hook, which freezes the timer + player input).
   */
  public showItemPopup(scene: Phaser.Scene, item: ItemData, onComplete?: () => void): void {
    this.onModalStateChanged?.(true);
    UIManager.createItemPopup(scene, item, () => {
      this.onModalStateChanged?.(false);
      onComplete?.();
    });
  }

  /**
   * Static popup builder — usable from any scene without a UIManager
   * instance (e.g. RoomScene). Pure visual: no pause/resume side effects.
   * Auto-dismisses after a short hold; calls onComplete after the out
   * animation finishes.
   */
  public static createItemPopup(
    scene: Phaser.Scene,
    item: ItemData,
    onComplete?: () => void
  ): void {
    const screenWidth = scene.scale.width;
    const screenHeight = scene.scale.height;

    const popupContainer = scene.add.container(0, 0);
    popupContainer.setDepth(2500);
    popupContainer.setScrollFactor(0);

    // Dim backdrop. Made interactive so it swallows pointer input and
    // prevents stray clicks (e.g., the magnifier button) during the popup.
    const backdrop = scene.add.rectangle(0, 0, screenWidth, screenHeight, 0x000000, 0.6);
    backdrop.setOrigin(0);
    backdrop.setInteractive();
    backdrop.setAlpha(0);

    // Card sub-container so we can scale/fade everything as one from its center.
    const card = scene.add.container(screenWidth / 2, screenHeight / 2);

    const foundLabel = scene.add.text(0, -90, 'FOUND!', {
      fontFamily: 'GameFont, Arial',
      fontSize: '32px',
      color: '#ffd700',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 5,
    });
    foundLabel.setOrigin(0.5);

    // Big item sprite, normalized to a uniform display size regardless of
    // source PNG dimensions (24/32/64).
    const sprite = scene.add.sprite(0, 0, item.spriteKey);
    const targetSize = 112;
    const naturalSize = Math.max(sprite.width, sprite.height) || targetSize;
    sprite.setScale(targetSize / naturalSize);

    const nameText = scene.add.text(0, 90, item.name, {
      fontFamily: 'GameFont, Arial',
      fontSize: '24px',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
    });
    nameText.setOrigin(0.5);

    card.add([foundLabel, sprite, nameText]);
    popupContainer.add([backdrop, card]);

    // Entry animation: card pops in with elastic ease, backdrop fades in.
    card.setScale(0);
    card.setAlpha(0);
    scene.tweens.add({
      targets: backdrop,
      alpha: 0.6,
      duration: 200,
      ease: 'Cubic.easeOut',
    });
    scene.tweens.add({
      targets: card,
      scale: 1,
      alpha: 1,
      duration: 400,
      ease: 'Back.easeOut',
      onComplete: () => {
        // Subtle bob on the sprite during the hold for a bit of life.
        scene.tweens.add({
          targets: sprite,
          y: -10,
          duration: 500,
          yoyo: true,
          ease: 'Sine.easeInOut',
        });

        // Hold ~1000ms, then pop out.
        scene.time.delayedCall(1000, () => {
          scene.tweens.add({
            targets: card,
            scale: 1.3,
            alpha: 0,
            duration: 300,
            ease: 'Cubic.easeIn',
          });
          scene.tweens.add({
            targets: backdrop,
            alpha: 0,
            duration: 300,
            onComplete: () => {
              popupContainer.destroy();
              onComplete?.();
            },
          });
        });
      },
    });
  }

  /**
   * Shows a game over message.
   */
  public showGameOver(scene: Phaser.Scene, won: boolean, itemsFound: number, totalItems: number): void {
    const screenWidth = scene.scale.width;
    const screenHeight = scene.scale.height;

    // Overlay
    const overlay = scene.add.rectangle(0, 0, screenWidth, screenHeight, 0x000000, 0.8);
    overlay.setOrigin(0);
    overlay.setDepth(3000);
    overlay.setScrollFactor(0);

    // Message
    const message = won ? 'CASE SOLVED!' : "TIME'S UP!";
    const messageText = scene.add.text(screenWidth / 2, screenHeight / 2 - 40, message, {
      fontFamily: 'GameFont, Arial',
      fontSize: '48px',
      color: won ? '#00ff00' : '#ff4444',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 6,
    });
    messageText.setOrigin(0.5);
    messageText.setDepth(3001);
    messageText.setScrollFactor(0);

    // Score
    const scoreText = scene.add.text(screenWidth / 2, screenHeight / 2 + 30, `Found ${itemsFound}/${totalItems} items`, {
      fontFamily: 'GameFont, Arial',
      fontSize: '24px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4,
    });
    scoreText.setOrigin(0.5);
    scoreText.setDepth(3001);
    scoreText.setScrollFactor(0);

    // Fade out and remove after 3 seconds
    scene.time.delayedCall(3000, () => {
      scene.tweens.add({
        targets: [overlay, messageText, scoreText],
        alpha: 0,
        duration: 500,
        onComplete: () => {
          overlay.destroy();
          messageText.destroy();
          scoreText.destroy();
        },
      });
    });
  }

  /**
   * Destroys the UI manager and cleans up resources.
   */
  public destroy(): void {
    this.evidenceBar?.destroy();
    this.evidenceBar = null;
    this.uiContainer.destroy(true);
  }
}
