import { ItemData } from '../types/game.types';

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
 * (indoors). Instead of a bottom bar, it's a bottom-left "Case File"
 * button that opens a paged, parchment-styled book — one item per page,
 * flipped with ◀/▶ arrows. Each page shows the item's description, plus a
 * big "?" until it's found and the item icon (with a FOUND stamp) once it
 * is. This is the detective "what am I looking for" checklist.
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
  private pageContent: Phaser.GameObjects.Container | null = null;
  private pageTitle: Phaser.GameObjects.Text | null = null;
  private pageDesc: Phaser.GameObjects.Text | null = null;
  private pageIcon: Phaser.GameObjects.Sprite | null = null;
  private pageQmark: Phaser.GameObjects.Text | null = null;
  private pageStamp: Phaser.GameObjects.Container | null = null;
  private pageIndicator: Phaser.GameObjects.Text | null = null;

  /** Index of the page currently shown in the book. */
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
    const pad = 16;

    const icon = this.scene.add.image(0, 0, 'casefile-folder');
    const targetH = 84;
    const scale = targetH / (icon.height || targetH);
    icon.setScale(scale);
    const iconW = icon.width * scale;
    const iconH = icon.height * scale;

    const cx = pad + iconW / 2;
    const cy = this.scene.scale.height - pad - iconH / 2;

    const container = this.scene.add.container(cx, cy);
    container.setDepth(1000);
    container.setScrollFactor(0);

    // Count sits on the folder's lower body, stroked so it reads on any art.
    this.countLabel = this.scene.add.text(0, iconH * 0.16, '', {
      fontFamily: 'GameFont, Arial',
      fontSize: '17px',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#3a2a14',
      strokeThickness: 4,
    });
    this.countLabel.setOrigin(0.5);

    container.add([icon, this.countLabel]);

    container.setSize(iconW, iconH);
    container.setInteractive(
      new Phaser.Geom.Rectangle(-iconW / 2, -iconH / 2, iconW, iconH),
      Phaser.Geom.Rectangle.Contains
    );
    container.on('pointerover', () => icon.setScale(scale * 1.06));
    container.on('pointerout', () => icon.setScale(scale));
    container.on('pointerdown', () => this.open());

    this.updateCount();
    return container;
  }

  private updateCount(): void {
    this.countLabel?.setText(`${this.collected.size} / ${this.items.length}`);
  }

  // --------------------------------------------------------------------
  // Book
  // --------------------------------------------------------------------

  private createBook(): Phaser.GameObjects.Container {
    const sw = this.scene.scale.width;
    const sh = this.scene.scale.height;

    const container = this.scene.add.container(0, 0);
    container.setDepth(2600);
    container.setScrollFactor(0);
    container.setVisible(false);

    const backdrop = this.scene.add.rectangle(0, 0, sw, sh, 0x000000, 0.6);
    backdrop.setOrigin(0);
    backdrop.setInteractive();
    backdrop.on('pointerdown', () => this.close());

    // Parchment page.
    const pw = 600;
    const ph = 440;
    const cx = sw / 2;
    const cy = sh / 2;

    const paper = this.scene.add.graphics();
    paper.fillStyle(0x000000, 0.35);
    paper.fillRoundedRect(cx - pw / 2 + 6, cy - ph / 2 + 8, pw, ph, 14); // soft shadow
    paper.fillStyle(0xf2e6c8, 1);
    paper.fillRoundedRect(cx - pw / 2, cy - ph / 2, pw, ph, 14);
    paper.lineStyle(3, 0xb59a5c, 1);
    paper.strokeRoundedRect(cx - pw / 2, cy - ph / 2, pw, ph, 14);
    paper.lineStyle(1, 0xd8c69a, 1);
    paper.strokeRoundedRect(cx - pw / 2 + 12, cy - ph / 2 + 12, pw - 24, ph - 24, 10);
    // A page-stopping it from being an interactive backdrop hole — the
    // paper swallows clicks so tapping the page doesn't close the book.
    const paperHit = this.scene.add.rectangle(cx, cy, pw, ph, 0xffffff, 0);
    paperHit.setInteractive();

    // Per-page content (swapped on flip; everything else stays put).
    const content = this.scene.add.container(0, 0);

    this.pageTitle = this.scene.add.text(cx, cy - ph / 2 + 40, '', {
      fontFamily: 'GameFont, Arial',
      fontSize: '26px',
      color: '#3a2f1a',
      fontStyle: 'bold',
    });
    this.pageTitle.setOrigin(0.5);

    this.pageIcon = this.scene.add.sprite(cx, cy - 40, '__DEFAULT');
    this.pageIcon.setVisible(false);

    this.pageQmark = this.scene.add.text(cx, cy - 50, '?', {
      fontFamily: 'GameFont, Arial',
      fontSize: '120px',
      color: '#b8a26a',
      fontStyle: 'bold',
    });
    this.pageQmark.setOrigin(0.5);

    this.pageStamp = this.createStamp(cx + pw / 2 - 96, cy - ph / 2 + 70);

    this.pageDesc = this.scene.add.text(cx, cy + 60, '', {
      fontFamily: 'GameFont, Arial',
      fontSize: '17px',
      color: '#4a3f28',
      align: 'center',
      wordWrap: { width: pw - 90 },
      lineSpacing: 6,
    });
    this.pageDesc.setOrigin(0.5, 0);

    this.pageIndicator = this.scene.add.text(cx, cy + ph / 2 - 30, '', {
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
    this.pageContent = content;

    const leftArrow = this.makeArrow(cx - pw / 2 - 4, cy, '◀', () => this.flip(-1));
    const rightArrow = this.makeArrow(cx + pw / 2 + 4, cy, '▶', () => this.flip(1));
    const closeBtn = this.makeClose(cx + pw / 2 - 26, cy - ph / 2 + 24);

    container.add([backdrop, paper, paperHit, content, leftArrow, rightArrow, closeBtn]);
    return container;
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
  // Open / close / paging
  // --------------------------------------------------------------------

  private open(): void {
    if (!this.book || this.isOpen) return;
    this.isOpen = true;
    this.updatePage(this.currentPage);
    this.book.setVisible(true);
    this.opts.onModalStateChanged?.(true);

    this.book.setAlpha(0);
    this.pageContent?.setScale(0.92);
    this.scene.tweens.add({ targets: this.book, alpha: 1, duration: 160, ease: 'Power2' });
    this.scene.tweens.add({
      targets: this.pageContent,
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

  /** Flips to the previous/next page (wraps around). */
  private flip(dir: number): void {
    const total = this.items.length;
    this.currentPage = (this.currentPage + dir + total) % total;

    // Quick slide + fade of the page content for a paged feel.
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

  /** Marks an item collected (or resets it); updates the count + open page. */
  public setCollected(itemId: string, collected: boolean = true): void {
    if (collected) this.collected.add(itemId);
    else this.collected.delete(itemId);
    this.updateCount();
    if (this.isOpen) this.updatePage(this.currentPage);
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
