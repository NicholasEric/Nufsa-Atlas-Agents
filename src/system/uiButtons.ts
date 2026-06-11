/**
 * Shared builder for the corner "pill" buttons (Search + Case File) so the
 * two always match. A pill is a stadium-shaped, gold-trimmed button with an
 * icon, a CAPS label, an optional sublabel (e.g. a count), a soft shadow,
 * hover/press feedback, and a gentle idle "breathing" halo so it reads as
 * interactive on a touch kiosk.
 */

export interface PillButton {
  container: Phaser.GameObjects.Container;
  width: number;
  height: number;
  /** The sublabel text (e.g. the evidence count), or null if none. */
  sublabelText: Phaser.GameObjects.Text | null;
}

const PILL_H = 52;
const PAD_X = 16;
const GAP = 9;
const ICON = 30;
const MARGIN = 16;
const RADIUS = PILL_H / 2;

export function createPillButton(
  scene: Phaser.Scene,
  anchor: 'bottom-left' | 'bottom-right',
  iconKey: string,
  label: string,
  onClick: () => void,
  sublabel?: string
): PillButton {
  const icon = scene.add.image(0, 0, iconKey);
  const iconScale = ICON / (Math.max(icon.width, icon.height) || ICON);
  icon.setScale(iconScale);
  const iconW = icon.width * iconScale;

  const labelText = scene.add.text(0, 0, label, {
    fontFamily: 'GameFont, Arial',
    fontSize: '18px',
    color: '#f0e2bd',
    fontStyle: 'bold',
  });
  labelText.setOrigin(0, 0.5);

  let subText: Phaser.GameObjects.Text | null = null;
  let subW = 0;
  if (sublabel !== undefined) {
    subText = scene.add.text(0, 0, sublabel, {
      fontFamily: 'GameFont, Arial',
      fontSize: '15px',
      color: '#b9a06a',
      fontStyle: 'bold',
    });
    subText.setOrigin(0, 0.5);
    subW = GAP + subText.width;
  }

  const w = PAD_X * 2 + iconW + GAP + labelText.width + subW;
  const h = PILL_H;

  const cy = scene.scale.height - MARGIN - h / 2;
  const cx = anchor === 'bottom-left' ? MARGIN + w / 2 : scene.scale.width - MARGIN - w / 2;

  const container = scene.add.container(cx, cy);
  container.setScrollFactor(0);

  // Idle breathing halo (gold), behind everything.
  const halo = scene.add.graphics();
  halo.lineStyle(3, 0xe7c66a, 1);
  halo.strokeRoundedRect(-w / 2 - 3, -h / 2 - 3, w + 6, h + 6, RADIUS + 3);
  halo.setAlpha(0.18);

  const shadow = scene.add.graphics();
  shadow.fillStyle(0x000000, 0.3);
  shadow.fillRoundedRect(-w / 2 + 2, -h / 2 + 4, w, h, RADIUS);

  const body = scene.add.graphics();
  body.fillStyle(0x2a2030, 0.96);
  body.fillRoundedRect(-w / 2, -h / 2, w, h, RADIUS);
  body.lineStyle(2, 0xc9a24b, 1);
  body.strokeRoundedRect(-w / 2, -h / 2, w, h, RADIUS);

  // Transparent white overlay that lightens the body on hover.
  const hover = scene.add.graphics();
  hover.fillStyle(0xffffff, 1);
  hover.fillRoundedRect(-w / 2, -h / 2, w, h, RADIUS);
  hover.setAlpha(0);

  // Lay out icon + label (+ sublabel) left-to-right.
  let penX = -w / 2 + PAD_X;
  icon.setPosition(penX + iconW / 2, 0);
  penX += iconW + GAP;
  labelText.setPosition(penX, 0);
  penX += labelText.width;
  if (subText) subText.setPosition(penX + GAP, 0);

  const children: Phaser.GameObjects.GameObject[] = [halo, shadow, body, hover, icon, labelText];
  if (subText) children.push(subText);
  container.add(children);

  container.setSize(w, h);
  container.setInteractive(
    new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h),
    Phaser.Geom.Rectangle.Contains
  );
  container.on('pointerover', () => hover.setAlpha(0.12));
  container.on('pointerout', () => hover.setAlpha(0));
  container.on('pointerdown', () => {
    scene.tweens.add({ targets: container, scale: 0.95, duration: 90, yoyo: true });
    onClick();
  });

  // Gentle idle breathing so it reads as a live button.
  scene.tweens.add({
    targets: halo,
    alpha: 0.5,
    duration: 950,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });

  return { container, width: w, height: h, sublabelText: subText };
}
