import { ItemData } from '../types/game.types';

/**
 * Options for an EvidenceBar.
 */
export interface EvidenceBarOptions {
  /**
   * Called with `true` when the description modal opens and `false` when
   * it closes. GameScene uses this to freeze the timer / player while the
   * player reads an item; RoomScene can ignore it (its timer is already
   * frozen by the paused GameScene).
   */
  onModalStateChanged?: (open: boolean) => void;
}

/**
 * Shared bottom evidence bar used by BOTH GameScene (outdoors) and
 * RoomScene (indoors), so the two can never visually drift.
 *
 * Renders one slot per global item: collected slots show the item art
 * (lit, green border, ✓); uncollected slots show a dark "?" so the art
 * stays a surprise until found. Tapping any slot opens a description
 * modal — this is the detective "what am I looking for" checklist.
 */
export class EvidenceBar {
  private scene: Phaser.Scene;
  private items: ItemData[];
  private collected: Set<string>;
  private opts: EvidenceBarOptions;

  /** Root container holding the panel + all slots (depth 1000). */
  private root: Phaser.GameObjects.Container;

  /** "n / total" counter in the header. */
  private countText: Phaser.GameObjects.Text | null = null;

  /** Per-item slot visuals, keyed by item id. */
  private slots: Map<
    string,
    {
      bg: Phaser.GameObjects.Rectangle;
      sprite: Phaser.GameObjects.Sprite;
      qmark: Phaser.GameObjects.Text;
      check: Phaser.GameObjects.Text;
    }
  > = new Map();

  /** Self-contained description modal (depth 2600), hidden by default. */
  private modal: Phaser.GameObjects.Container | null = null;
  private modalName: Phaser.GameObjects.Text | null = null;
  private modalDescription: Phaser.GameObjects.Text | null = null;

  constructor(
    scene: Phaser.Scene,
    items: ItemData[],
    collectedIds: Iterable<string>,
    opts: EvidenceBarOptions = {}
  ) {
    this.scene = scene;
    this.items = items;
    this.collected = new Set(collectedIds);
    this.opts = opts;

    this.root = scene.add.container(0, 0);
    this.root.setDepth(1000);
    this.root.setScrollFactor(0);

    this.build();
    this.createModal();
  }

  /**
   * Builds the panel, header, and one slot per item. Slot size/pitch are
   * derived from the item count so the row stays inside the screen even
   * as more items are added (e.g. a third map).
   */
  private build(): void {
    const screenW = this.scene.scale.width;
    const screenH = this.scene.scale.height;

    const panelHeight = 92;
    const panelMargin = 8;
    const panelY = screenH - panelHeight - panelMargin;

    const panelBg = this.scene.add.rectangle(
      screenW / 2,
      panelY + panelHeight / 2,
      screenW - 16,
      panelHeight,
      0x1a1a2e,
      0.92
    );
    panelBg.setStrokeStyle(2, 0x4a4a6a);
    this.root.add(panelBg);

    const title = this.scene.add.text(20, panelY + 8, 'EVIDENCE', {
      fontFamily: 'GameFont, Arial',
      fontSize: '14px',
      color: '#8888aa',
      fontStyle: 'bold',
    });
    this.root.add(title);

    this.countText = this.scene.add.text(screenW - 20, panelY + 8, '', {
      fontFamily: 'GameFont, Arial',
      fontSize: '14px',
      color: '#aaaacc',
      fontStyle: 'bold',
    });
    this.countText.setOrigin(1, 0);
    this.root.add(this.countText);

    // Responsive slot layout — center the row, shrink to fit.
    const sideMargin = 24;
    const availW = screenW - sideMargin * 2;
    const pitch = Math.min(74, availW / this.items.length);
    const slotSize = Math.min(56, pitch - 10);
    const rowW = pitch * this.items.length;
    const firstCenterX = sideMargin + (availW - rowW) / 2 + pitch / 2;
    const slotCenterY = panelY + panelHeight / 2 + 8;

    this.items.forEach((item, i) => {
      const cx = firstCenterX + i * pitch;
      this.createSlot(item, cx, slotCenterY, slotSize);
    });

    this.updateCount();
  }

  /**
   * Creates a single tappable slot for one item.
   */
  private createSlot(item: ItemData, cx: number, cy: number, size: number): void {
    const bg = this.scene.add.rectangle(cx, cy, size, size, 0x20202e, 1);
    bg.setStrokeStyle(2, 0x444455);
    bg.setInteractive({ useHandCursor: true });
    this.root.add(bg);

    const sprite = this.scene.add.sprite(cx, cy, item.spriteKey);
    const fit = size * 0.72;
    const natural = Math.max(sprite.width, sprite.height) || fit;
    sprite.setScale(fit / natural);
    sprite.setVisible(false);
    this.root.add(sprite);

    const qmark = this.scene.add.text(cx, cy, '?', {
      fontFamily: 'GameFont, Arial',
      fontSize: `${Math.round(size * 0.5)}px`,
      color: '#555566',
      fontStyle: 'bold',
    });
    qmark.setOrigin(0.5);
    this.root.add(qmark);

    const check = this.scene.add.text(cx + size / 2 - 6, cy - size / 2 + 4, '', {
      fontFamily: 'GameFont, Arial',
      fontSize: '16px',
      color: '#00ff00',
      fontStyle: 'bold',
    });
    check.setOrigin(0.5, 0);
    this.root.add(check);

    bg.on('pointerover', () => bg.setFillStyle(0x2e2e40));
    bg.on('pointerout', () => bg.setFillStyle(this.collected.has(item.id) ? 0x223322 : 0x20202e));
    bg.on('pointerdown', () => this.showDescription(item));

    this.slots.set(item.id, { bg, sprite, qmark, check });

    if (this.collected.has(item.id)) this.applyCollectedVisual(item.id);
  }

  /**
   * Marks an item collected (or, with `collected=false`, resets it) and
   * updates its slot + the header count.
   */
  public setCollected(itemId: string, collected: boolean = true): void {
    if (collected) this.collected.add(itemId);
    else this.collected.delete(itemId);

    if (collected) this.applyCollectedVisual(itemId);
    else this.applyUncollectedVisual(itemId);

    this.updateCount();
  }

  private applyCollectedVisual(itemId: string): void {
    const slot = this.slots.get(itemId);
    if (!slot) return;
    slot.bg.setFillStyle(0x223322);
    slot.bg.setStrokeStyle(2, 0x00ff00);
    slot.sprite.setVisible(true);
    slot.qmark.setVisible(false);
    slot.check.setText('✓');
  }

  private applyUncollectedVisual(itemId: string): void {
    const slot = this.slots.get(itemId);
    if (!slot) return;
    slot.bg.setFillStyle(0x20202e);
    slot.bg.setStrokeStyle(2, 0x444455);
    slot.sprite.setVisible(false);
    slot.qmark.setVisible(true);
    slot.check.setText('');
  }

  private updateCount(): void {
    this.countText?.setText(`${this.collected.size} / ${this.items.length}`);
  }

  /** Whether every item has been collected. */
  public isComplete(): boolean {
    return this.collected.size >= this.items.length;
  }

  /**
   * Builds the (hidden) description modal once. Reused for every slot tap.
   */
  private createModal(): void {
    const screenW = this.scene.scale.width;
    const screenH = this.scene.scale.height;

    const container = this.scene.add.container(0, 0);
    container.setDepth(2600);
    container.setScrollFactor(0);
    container.setVisible(false);

    const backdrop = this.scene.add.rectangle(0, 0, screenW, screenH, 0x000000, 0.7);
    backdrop.setOrigin(0);
    backdrop.setInteractive();

    const panelWidth = Math.min(screenW - 40, 500);
    const panelHeight = 250;
    const panelX = screenW / 2 - panelWidth / 2;
    const panelY = screenH / 2 - panelHeight / 2;

    const panel = this.scene.add.rectangle(panelX, panelY, panelWidth, panelHeight, 0x2a2a3e);
    panel.setStrokeStyle(2, 0x6666aa);
    panel.setOrigin(0);

    this.modalName = this.scene.add.text(panelX + 20, panelY + 20, '', {
      fontFamily: 'GameFont, Arial',
      fontSize: '24px',
      color: '#ffffff',
      fontStyle: 'bold',
    });

    this.modalDescription = this.scene.add.text(panelX + 20, panelY + 64, '', {
      fontFamily: 'GameFont, Arial',
      fontSize: '16px',
      color: '#cccccc',
      wordWrap: { width: panelWidth - 40 },
      lineSpacing: 8,
    });

    const closeBtn = this.scene.add.text(panelX + panelWidth - 38, panelY + 10, '✕', {
      fontFamily: 'GameFont, Arial',
      fontSize: '24px',
      color: '#888888',
    });
    closeBtn.setInteractive({ useHandCursor: true });
    closeBtn.on('pointerover', () => closeBtn.setColor('#ffffff'));
    closeBtn.on('pointerout', () => closeBtn.setColor('#888888'));
    closeBtn.on('pointerdown', () => this.hideDescription());

    // Tap anywhere outside the panel closes too.
    backdrop.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (
        pointer.x < panelX ||
        pointer.x > panelX + panelWidth ||
        pointer.y < panelY ||
        pointer.y > panelY + panelHeight
      ) {
        this.hideDescription();
      }
    });

    container.add([backdrop, panel, this.modalName, this.modalDescription, closeBtn]);
    this.modal = container;
  }

  /**
   * Opens the description modal for an item (collected or not — it's the
   * "what to look for" checklist).
   */
  private showDescription(item: ItemData): void {
    if (!this.modal || !this.modalName || !this.modalDescription) return;
    this.modalName.setText(item.name);
    this.modalDescription.setText(item.description);
    this.modal.setVisible(true);
    this.opts.onModalStateChanged?.(true);

    this.modal.setAlpha(0);
    this.scene.tweens.add({ targets: this.modal, alpha: 1, duration: 180, ease: 'Power2' });
  }

  private hideDescription(): void {
    if (!this.modal) return;
    this.opts.onModalStateChanged?.(false);
    this.scene.tweens.add({
      targets: this.modal,
      alpha: 0,
      duration: 140,
      ease: 'Power2',
      onComplete: () => this.modal?.setVisible(false),
    });
  }

  /**
   * Destroys all bar + modal objects.
   */
  public destroy(): void {
    this.root.destroy(true);
    this.modal?.destroy(true);
    this.slots.clear();
  }
}
