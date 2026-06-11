import { ItemData } from '../types/game.types';
import { createPillButton } from './uiButtons';

/**
 * Options for a CaseFile.
 */
export interface CaseFileOptions {
  /**
   * Called with `true` when the book opens and `false` when it closes.
   * GameScene uses this to freeze the timer / player while the player
   * reads the case file; RoomScene can ignore it (its timer is already
   * frozen by the paused GameScene).
   */
  onModalStateChanged?: (open: boolean) => void;
}

/**
 * Shared evidence UI used by BOTH GameScene (outdoors) and RoomScene
 * (indoors). A bottom-left "Case File" button opens a parchment book with
 * two views:
 *   - GRID: a 5×4 box of all item slots (icon once found, "?" until then).
 *     Tapping a slot opens…
 *   - PAGE: the single-item detail page (name + description, big "?" until
 *     found, icon + FOUND stamp once collected), flipped with ◀/▶, with a
 *     "‹ All" button back to the grid.
 */
export class CaseFile {
  private scene: Phaser.Scene;
  private items: ItemData[];
  private collected: Set<string>;
  private opts: CaseFileOptions;

  /** Bottom-left button that opens the book (depth 1000). */
  private button: Phaser.GameObjects.Container;
  private countLabel: Phaser.GameObjects.Text | null = null;

  /** The book popup (depth 2600), hidden until the button is pressed. */
  private book: Phaser.GameObjects.Container | null = null;
  private headerTitle: Phaser.GameObjects.Text | null = null;
  private headerCount: Phaser.GameObjects.Text | null = null;

  /** Grid view. */
  private gridContent: Phaser.GameObjects.Container | null = null;
  private gridSlots: Map<
    string,
    {
      bg: Phaser.GameObjects.Rectangle;
      icon: Phaser.GameObjects.Sprite;
      qmark: Phaser.GameObjects.Text;
    }
  > = new Map();

  /** Page (single-item) view. */
  private pageContent: Phaser.GameObjects.Container | null = null;
  private pageTitle: Phaser.GameObjects.Text | null = null;
  private pageDesc: Phaser.GameObjects.Text | null = null;
  private pageIcon: Phaser.GameObjects.Sprite | null = null;
  private pageQmark: Phaser.GameObjects.Text | null = null;
  private pageStamp: Phaser.GameObjects.Container | null = null;
  private pageIndicator: Phaser.GameObjects.Text | null = null;
  private leftArrow: Phaser.GameObjects.Text | null = null;
  private rightArrow: Phaser.GameObjects.Text | null = null;
  private backBtn: Phaser.GameObjects.Text | null = null;

  private mode: 'grid' | 'page' = 'grid';
  private currentPage = 0;
  private isOpen = false;

  constructor(
    scene: Phaser.Scene,
    items: ItemData[],
    collectedIds: Iterable<string>,
    opts: CaseFileOptions = {}
  ) {
    this.scene = scene;
    this.items = items;
    this.collected = new Set(collectedIds);
    this.opts = opts;

    this.button = this.createButton();
    this.book = this.createBook();
  }

  // --------------------------------------------------------------------
  // Button
  // --------------------------------------------------------------------

  private createButton(): Phaser.GameObjects.Container {
    const initialCount = `${this.collected.size} / ${this.items.length}`;
    const pill = createPillButton(
      this.scene,
      'bottom-left',
      'casefile-folder',
      'CASE FILE',
      () => this.open(),
      initialCount
    );
    pill.container.setDepth(1000);
    this.countLabel = pill.sublabelText;
    return pill.container;
  }

  private updateCount(): void {
    const text = `${this.collected.size} / ${this.items.length}`;
    this.countLabel?.setText(text);
    this.headerCount?.setText(text);
  }

  // --------------------------------------------------------------------
  // Book chrome (shared by both views)
  // --------------------------------------------------------------------

  private createBook(): Phaser.GameObjects.Container {
    const sw = this.scene.scale.width;
    const sh = this.scene.scale.height;
    const cx = sw / 2;
    const cy = sh / 2;
    const pw = 660;
    const ph = 480;

    const container = this.scene.add.container(0, 0);
    container.setDepth(2600);
    container.setScrollFactor(0);
    container.setVisible(false);

    const backdrop = this.scene.add.rectangle(0, 0, sw, sh, 0x000000, 0.6);
    backdrop.setOrigin(0);
    backdrop.setInteractive();
    backdrop.on('pointerdown', () => this.close());

    // Parchment page with soft shadow + inner rule.
    const paper = this.scene.add.graphics();
    paper.fillStyle(0x000000, 0.35);
    paper.fillRoundedRect(cx - pw / 2 + 6, cy - ph / 2 + 8, pw, ph, 14);
    paper.fillStyle(0xf2e6c8, 1);
    paper.fillRoundedRect(cx - pw / 2, cy - ph / 2, pw, ph, 14);
    paper.lineStyle(3, 0xb59a5c, 1);
    paper.strokeRoundedRect(cx - pw / 2, cy - ph / 2, pw, ph, 14);
    paper.lineStyle(1, 0xd8c69a, 1);
    paper.strokeRoundedRect(cx - pw / 2 + 12, cy - ph / 2 + 12, pw - 24, ph - 24, 10);
    // Swallows clicks so tapping the page doesn't close the book.
    const paperHit = this.scene.add.rectangle(cx, cy, pw, ph, 0xffffff, 0);
    paperHit.setInteractive();

    // Header: "CASE FILE" title (grid mode) / "‹ All" back (page mode),
    // a centered count, and a close button.
    this.headerTitle = this.scene.add.text(cx - pw / 2 + 30, cy - ph / 2 + 28, 'CASE FILE', {
      fontFamily: 'GameFont, Arial',
      fontSize: '22px',
      color: '#3a2f1a',
      fontStyle: 'bold',
    });
    this.headerTitle.setOrigin(0, 0.5);

    this.backBtn = this.scene.add.text(cx - pw / 2 + 30, cy - ph / 2 + 28, '‹ All', {
      fontFamily: 'GameFont, Arial',
      fontSize: '20px',
      color: '#6a5a30',
      fontStyle: 'bold',
    });
    this.backBtn.setOrigin(0, 0.5);
    this.backBtn.setInteractive({ useHandCursor: true });
    this.backBtn.on('pointerover', () => this.backBtn?.setColor('#3a2f1a'));
    this.backBtn.on('pointerout', () => this.backBtn?.setColor('#6a5a30'));
    this.backBtn.on('pointerdown', () => this.showGrid());

    this.headerCount = this.scene.add.text(cx, cy - ph / 2 + 28, '', {
      fontFamily: 'GameFont, Arial',
      fontSize: '18px',
      color: '#8a7a52',
      fontStyle: 'bold',
    });
    this.headerCount.setOrigin(0.5);

    const closeBtn = this.makeClose(cx + pw / 2 - 28, cy - ph / 2 + 26);

    this.gridContent = this.createGrid(cx, cy, ph);
    this.pageContent = this.createPage(cx, cy, pw, ph);

    this.leftArrow = this.makeArrow(cx - pw / 2 - 6, cy, '◀', () => this.flip(-1));
    this.rightArrow = this.makeArrow(cx + pw / 2 + 6, cy, '▶', () => this.flip(1));

    container.add([
      backdrop,
      paper,
      paperHit,
      this.headerTitle,
      this.backBtn,
      this.headerCount,
      closeBtn,
      this.gridContent,
      this.pageContent,
      this.leftArrow,
      this.rightArrow,
    ]);

    this.updateCount();
    return container;
  }

  // --------------------------------------------------------------------
  // Grid view (5×4)
  // --------------------------------------------------------------------

  private createGrid(cx: number, cy: number, ph: number): Phaser.GameObjects.Container {
    const content = this.scene.add.container(0, 0);

    const cols = 5;
    const pitchX = 117;
    const pitchY = 95;
    const cell = 86;
    const startX = cx - 2 * pitchX;
    const startY = cy - ph / 2 + 124;

    this.items.forEach((item, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * pitchX;
      const y = startY + row * pitchY;

      const bg = this.scene.add.rectangle(x, y, cell, cell, 0xd8c8a0);
      bg.setStrokeStyle(2, 0xb59a5c);
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerover', () => bg.setFillStyle(0xe7dcc0));
      bg.on('pointerout', () => bg.setFillStyle(this.collected.has(item.id) ? 0xe8dcb6 : 0xd8c8a0));
      bg.on('pointerdown', () => this.showPage(i));

      const icon = this.scene.add.sprite(x, y, item.spriteKey);
      const fit = 56;
      const natural = Math.max(icon.width, icon.height) || fit;
      icon.setScale(fit / natural);

      const qmark = this.scene.add.text(x, y, '?', {
        fontFamily: 'GameFont, Arial',
        fontSize: '40px',
        color: '#b8a26a',
        fontStyle: 'bold',
      });
      qmark.setOrigin(0.5);

      content.add([bg, icon, qmark]);
      this.gridSlots.set(item.id, { bg, icon, qmark });
      this.applyGridSlot(item.id);
    });

    return content;
  }

  private applyGridSlot(itemId: string): void {
    const slot = this.gridSlots.get(itemId);
    if (!slot) return;
    const found = this.collected.has(itemId);
    slot.bg.setFillStyle(found ? 0xe8dcb6 : 0xd8c8a0);
    slot.bg.setStrokeStyle(2, found ? 0x3a8f4a : 0xb59a5c);
    slot.icon.setVisible(found);
    slot.qmark.setVisible(!found);
  }

  // --------------------------------------------------------------------
  // Page view (single item)
  // --------------------------------------------------------------------

  private createPage(cx: number, cy: number, pw: number, ph: number): Phaser.GameObjects.Container {
    const content = this.scene.add.container(0, 0);

    this.pageTitle = this.scene.add.text(cx, cy - ph / 2 + 74, '', {
      fontFamily: 'GameFont, Arial',
      fontSize: '28px',
      color: '#3a2f1a',
      fontStyle: 'bold',
    });
    this.pageTitle.setOrigin(0.5);

    this.pageIcon = this.scene.add.sprite(cx, cy - 30, '__DEFAULT');
    this.pageIcon.setVisible(false);

    this.pageQmark = this.scene.add.text(cx, cy - 40, '?', {
      fontFamily: 'GameFont, Arial',
      fontSize: '120px',
      color: '#b8a26a',
      fontStyle: 'bold',
    });
    this.pageQmark.setOrigin(0.5);

    this.pageStamp = this.createStamp(cx + pw / 2 - 100, cy - ph / 2 + 90);

    this.pageDesc = this.scene.add.text(cx, cy + 64, '', {
      fontFamily: 'GameFont, Arial',
      fontSize: '17px',
      color: '#4a3f28',
      align: 'center',
      wordWrap: { width: pw - 100 },
      lineSpacing: 6,
    });
    this.pageDesc.setOrigin(0.5, 0);

    this.pageIndicator = this.scene.add.text(cx, cy + ph / 2 - 28, '', {
      fontFamily: 'GameFont, Arial',
      fontSize: '15px',
      color: '#8a7a52',
    });
    this.pageIndicator.setOrigin(0.5);

    content.add([
      this.pageTitle,
      this.pageIcon,
      this.pageQmark,
      this.pageStamp,
      this.pageDesc,
      this.pageIndicator,
    ]);
    content.setVisible(false);
    return content;
  }

  /** A rotated "FOUND" stamp shown on collected pages. */
  private createStamp(x: number, y: number): Phaser.GameObjects.Container {
    const c = this.scene.add.container(x, y);
    const txt = this.scene.add.text(0, 0, 'FOUND', {
      fontFamily: 'GameFont, Arial',
      fontSize: '22px',
      color: '#b23b3b',
      fontStyle: 'bold',
    });
    txt.setOrigin(0.5);
    const g = this.scene.add.graphics();
    g.lineStyle(3, 0xb23b3b, 0.9);
    g.strokeRoundedRect(-txt.width / 2 - 10, -txt.height / 2 - 4, txt.width + 20, txt.height + 8, 6);
    c.add([g, txt]);
    c.setAngle(-14);
    c.setAlpha(0.85);
    return c;
  }

  private makeArrow(
    x: number,
    y: number,
    glyph: string,
    onClick: () => void
  ): Phaser.GameObjects.Text {
    const t = this.scene.add.text(x, y, glyph, {
      fontFamily: 'GameFont, Arial',
      fontSize: '44px',
      color: '#e8d6a8',
      fontStyle: 'bold',
    });
    t.setOrigin(0.5);
    t.setInteractive({ useHandCursor: true });
    t.on('pointerover', () => t.setColor('#ffffff'));
    t.on('pointerout', () => t.setColor('#e8d6a8'));
    t.on('pointerdown', onClick);
    return t;
  }

  private makeClose(x: number, y: number): Phaser.GameObjects.Text {
    const t = this.scene.add.text(x, y, '✕', {
      fontFamily: 'GameFont, Arial',
      fontSize: '24px',
      color: '#8a7a52',
      fontStyle: 'bold',
    });
    t.setOrigin(0.5);
    t.setInteractive({ useHandCursor: true });
    t.on('pointerover', () => t.setColor('#b23b3b'));
    t.on('pointerout', () => t.setColor('#8a7a52'));
    t.on('pointerdown', () => this.close());
    return t;
  }

  // --------------------------------------------------------------------
  // Open / close / view switching
  // --------------------------------------------------------------------

  private open(): void {
    if (!this.book || this.isOpen) return;
    this.isOpen = true;
    this.showGrid();
    this.book.setVisible(true);
    this.opts.onModalStateChanged?.(true);

    this.book.setAlpha(0);
    this.gridContent?.setScale(0.94);
    this.scene.tweens.add({ targets: this.book, alpha: 1, duration: 160, ease: 'Power2' });
    this.scene.tweens.add({
      targets: this.gridContent,
      scale: 1,
      duration: 220,
      ease: 'Back.easeOut',
    });
  }

  private close(): void {
    if (!this.book || !this.isOpen) return;
    this.isOpen = false;
    this.opts.onModalStateChanged?.(false);
    this.scene.tweens.add({
      targets: this.book,
      alpha: 0,
      duration: 140,
      ease: 'Power2',
      onComplete: () => this.book?.setVisible(false),
    });
  }

  /** Shows the 5×4 grid overview. */
  private showGrid(): void {
    this.mode = 'grid';
    this.gridContent?.setVisible(true);
    this.pageContent?.setVisible(false);
    this.headerTitle?.setVisible(true);
    this.backBtn?.setVisible(false);
    this.leftArrow?.setVisible(false);
    this.rightArrow?.setVisible(false);
  }

  /** Opens the detail page for the item at `index`. */
  private showPage(index: number): void {
    this.mode = 'page';
    this.currentPage = index;
    this.updatePage(index);
    this.gridContent?.setVisible(false);
    this.pageContent?.setVisible(true);
    this.headerTitle?.setVisible(false);
    this.backBtn?.setVisible(true);
    this.leftArrow?.setVisible(true);
    this.rightArrow?.setVisible(true);

    this.pageContent?.setScale(0.96);
    this.scene.tweens.add({ targets: this.pageContent, scale: 1, duration: 170, ease: 'Back.easeOut' });
  }

  /** Flips to the previous/next item page (wraps around). */
  private flip(dir: number): void {
    const total = this.items.length;
    this.currentPage = (this.currentPage + dir + total) % total;

    if (this.pageContent) {
      this.pageContent.setAlpha(0);
      this.pageContent.x = dir * 24;
      this.updatePage(this.currentPage);
      this.scene.tweens.add({
        targets: this.pageContent,
        x: 0,
        alpha: 1,
        duration: 160,
        ease: 'Power2',
      });
    } else {
      this.updatePage(this.currentPage);
    }
  }

  private updatePage(index: number): void {
    const item = this.items[index];
    if (!item) return;
    const found = this.collected.has(item.id);

    this.pageTitle?.setText(found ? item.name : '? ? ?');
    this.pageDesc?.setText(item.description);
    this.pageIndicator?.setText(`${index + 1} / ${this.items.length}`);

    if (this.pageIcon) {
      if (found) {
        this.pageIcon.setTexture(item.spriteKey);
        const fit = 150;
        const natural = Math.max(this.pageIcon.width, this.pageIcon.height) || fit;
        this.pageIcon.setScale(fit / natural);
      }
      this.pageIcon.setVisible(found);
    }
    this.pageQmark?.setVisible(!found);
    this.pageStamp?.setVisible(found);
  }

  // --------------------------------------------------------------------
  // Public API
  // --------------------------------------------------------------------

  /** Marks an item collected (or resets it); refreshes count, grid, page. */
  public setCollected(itemId: string, collected: boolean = true): void {
    if (collected) this.collected.add(itemId);
    else this.collected.delete(itemId);
    this.updateCount();
    this.applyGridSlot(itemId);
    if (this.isOpen && this.mode === 'page') this.updatePage(this.currentPage);
  }

  /** Whether every item has been collected. */
  public isComplete(): boolean {
    return this.collected.size >= this.items.length;
  }

  /**
   * Root display objects (button + book). GameScene assigns these to the
   * un-zoomed UI camera so the per-map world zoom doesn't scale them.
   */
  public getDisplayObjects(): Phaser.GameObjects.GameObject[] {
    const objs: Phaser.GameObjects.GameObject[] = [this.button];
    if (this.book) objs.push(this.book);
    return objs;
  }

  public destroy(): void {
    this.button.destroy(true);
    this.book?.destroy(true);
  }
}
