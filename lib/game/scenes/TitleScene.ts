/**
 * TitleScene.ts
 * Pixel-art title screen for Kujou High School
 */

import Phaser from 'phaser';
import { loadGeneratedAssets, generateBackground } from '../assets/SpriteGenerator';

export class TitleScene extends Phaser.Scene {
  private bgGraphics!: Phaser.GameObjects.Graphics;
  private titleText!: Phaser.GameObjects.Text;
  private subtitleText!: Phaser.GameObjects.Text;
  private promptText!: Phaser.GameObjects.Text;
  private characterSprite!: Phaser.GameObjects.Sprite;
  private scanlineGraphics!: Phaser.GameObjects.Graphics;
  private particles!: Phaser.GameObjects.Particles.ParticleEmitter | null;

  constructor() {
    super({ key: 'TitleScene' });
  }

  preload() {
    // Assets are generated in create
  }

  create() {
    const { width: W, height: H } = this.scale;

    // Load generated assets into texture cache
    loadGeneratedAssets(this);

    // Register animations (import dynamically to avoid circular dep)
    this.registerAnims();

    // ── BACKGROUND ──────────────────────────

    // Layer 0: night sky
    this.add.image(W / 2, H / 2, 'bg0').setDisplaySize(W, H).setDepth(0);
    // Layer 1: school silhouette
    this.add.image(W / 2, H / 2, 'bg1').setDisplaySize(W, H).setDepth(1).setAlpha(0.9);
    // Layer 2: foreground
    this.add.image(W / 2, H / 2, 'bg2').setDisplaySize(W, H).setDepth(2);

    // Ground
    const groundGfx = this.add.graphics().setDepth(3);
    groundGfx.fillStyle(0x1a1428, 1);
    groundGfx.fillRect(0, H * 0.78, W, H * 0.22);
    groundGfx.lineStyle(2, 0x6644aa, 0.8);
    groundGfx.lineBetween(0, H * 0.78, W, H * 0.78);

    // ── SCANLINES OVERLAY ────────────────────

    this.scanlineGraphics = this.add.graphics().setDepth(100).setAlpha(0.1);
    for (let y = 0; y < H; y += 2) {
      this.scanlineGraphics.lineStyle(1, 0x000000, 1);
      this.scanlineGraphics.lineBetween(0, y, W, y);
    }

    // ── CHARACTER ───────────────────────────

    this.characterSprite = this.add.sprite(W * 0.5, H * 0.73, 'player')
      .setScale(4)
      .setDepth(5);
    this.characterSprite.play('player_idle');

    // Umbrella shadow
    const shadowGfx = this.add.graphics().setDepth(4);
    shadowGfx.fillStyle(0x000000, 0.3);
    shadowGfx.fillEllipse(W * 0.5, H * 0.76, 80, 12);

    // ── TITLE TEXT ───────────────────────────

    // Japanese title
    this.titleText = this.add.text(W / 2, H * 0.18, '久条高校', {
      fontSize: '64px',
      fontFamily: '"Courier New", monospace',
      color: '#ffffff',
      stroke: '#6622aa',
      strokeThickness: 8,
      shadow: { offsetX: 4, offsetY: 4, color: '#000000', blur: 8, fill: true },
    }).setOrigin(0.5).setDepth(10);

    // English subtitle
    this.subtitleText = this.add.text(W / 2, H * 0.30, 'KUJOU HIGH SCHOOL', {
      fontSize: '22px',
      fontFamily: '"Courier New", monospace',
      color: '#cc88ff',
      letterSpacing: 8,
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(10);

    // Tagline
    this.add.text(W / 2, H * 0.38, '〜傘と拳で夜を砕け〜', {
      fontSize: '14px',
      fontFamily: '"Courier New", monospace',
      color: '#8866cc',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(10);

    // ── MENU OPTIONS ─────────────────────────

    const menuItems = [
      { label: 'PRESS ENTER TO START', y: H * 0.52 },
    ];

    this.promptText = this.add.text(W / 2, H * 0.52, '[ PRESS  ENTER  TO  START ]', {
      fontSize: '20px',
      fontFamily: '"Courier New", monospace',
      color: '#ffee44',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(10);

    // EDIT ボタン
    const editBtn = this.add.text(W / 2, H * 0.59, '[ COURSE EDITOR ]', {
      fontSize: '15px',
      fontFamily: '"Courier New", monospace',
      color: '#44ddaa',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(10).setInteractive({ cursor: 'pointer' });
    editBtn.on('pointerover', () => editBtn.setStyle({ color: '#88ffcc' }));
    editBtn.on('pointerout',  () => editBtn.setStyle({ color: '#44ddaa' }));
    editBtn.on('pointerdown', () => this.startEditor());
    this.tweens.add({
      targets: editBtn, alpha: 0.6, duration: 900, yoyo: true, repeat: -1,
    });

    // セーブデータから遊ぶ
    const savedLevels = (() => {
      try {
        const raw = localStorage.getItem('kujou_custom_levels');
        return raw ? (JSON.parse(raw) as any[]) : [];
      } catch { return []; }
    })();
    if (savedLevels.length > 0) {
      const playCustomBtn = this.add.text(W / 2, H * 0.645, `[ マイコースで遊ぶ (${savedLevels.length}コース) ]`, {
        fontSize: '12px',
        fontFamily: '"Courier New", monospace',
        color: '#aaddff',
        stroke: '#000000',
        strokeThickness: 2,
      }).setOrigin(0.5).setDepth(10).setInteractive({ cursor: 'pointer' });
      playCustomBtn.on('pointerover', () => playCustomBtn.setStyle({ color: '#ddeeff' }));
      playCustomBtn.on('pointerout',  () => playCustomBtn.setStyle({ color: '#aaddff' }));
      playCustomBtn.on('pointerdown', () => this.showCustomLevelMenu(savedLevels));
    }

    // Controls hint
    const controls = [
      '←→/WASD : 移動    SPACE : ジャンプ    SHIFT : ダッシュ',
      'Z : 攻撃    X : ガード    C : 必殺技',
    ];
    controls.forEach((line, i) => {
      this.add.text(W / 2, H * 0.62 + i * 22, line, {
        fontSize: '11px',
        fontFamily: '"Courier New", monospace',
        color: '#7755aa',
        stroke: '#000000',
        strokeThickness: 2,
      }).setOrigin(0.5).setDepth(10);
    });

    // ── CORNER DECORATIONS ───────────────────

    const decGfx = this.add.graphics().setDepth(10);
    decGfx.lineStyle(1, 0x6633aa, 0.8);
    // Corner brackets
    [[20,20],[W-20,20],[20,H-20],[W-20,H-20]].forEach(([cx,cy],i) => {
      const sx = i % 2 === 0 ? 1 : -1;
      const sy = i < 2 ? 1 : -1;
      decGfx.lineBetween(cx, cy, cx + sx*24, cy);
      decGfx.lineBetween(cx, cy, cx, cy + sy*24);
    });

    // Version
    this.add.text(W - 12, H - 12, 'v1.0', {
      fontSize: '10px', fontFamily: 'monospace', color: '#443366'
    }).setOrigin(1, 1).setDepth(10);

    // ── ANIMATIONS ───────────────────────────

    // Title flicker
    this.tweens.add({
      targets: this.titleText,
      alpha: { from: 1, to: 0.85 },
      duration: 150,
      yoyo: true,
      repeat: -1,
      repeatDelay: 3000,
    });

    // Prompt blink
    this.tweens.add({
      targets: this.promptText,
      alpha: 0,
      duration: 500,
      yoyo: true,
      repeat: -1,
    });

    // Title entry animation
    this.titleText.setAlpha(0).setY(H * 0.10);
    this.subtitleText.setAlpha(0);
    this.characterSprite.setAlpha(0).setX(W * 0.3);

    this.tweens.add({
      targets: this.titleText,
      alpha: 1,
      y: H * 0.18,
      duration: 600,
      ease: 'Power2',
      delay: 200,
    });
    this.tweens.add({
      targets: this.subtitleText,
      alpha: 1,
      duration: 500,
      delay: 700,
    });
    this.tweens.add({
      targets: this.characterSprite,
      alpha: 1,
      x: W * 0.5,
      duration: 700,
      ease: 'Power2',
      delay: 400,
    });

    // ── CHERRY BLOSSOM PARTICLES ─────────────
    try {
      // Simple colored squares as petals
      const gfxTex = this.add.graphics();
      gfxTex.fillStyle(0xff99bb, 1);
      gfxTex.fillRect(0, 0, 4, 4);
      gfxTex.generateTexture('petal', 4, 4);
      gfxTex.destroy();

      this.particles = this.add.particles(0, 0, 'petal', {
        x: { min: 0, max: W },
        y: -10,
        speedX: { min: -20, max: 20 },
        speedY: { min: 30, max: 80 },
        lifespan: { min: 3000, max: 6000 },
        quantity: 1,
        frequency: 200,
        alpha: { start: 0.8, end: 0 },
        rotate: { min: 0, max: 360 },
        scale: { min: 0.5, max: 1.5 },
        tint: [0xff88aa, 0xffbbcc, 0xffaacc],
      }).setDepth(6);
    } catch { this.particles = null; }

    // ── INPUT ────────────────────────────────

    this.input.keyboard!.once('keydown-ENTER', () => this.startGame());
    this.input.keyboard!.once('keydown-SPACE', () => this.startGame());
    this.input.on('pointerdown', () => this.startGame());
  }

  private startGame() {
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.time.delayedCall(400, () => {
      this.scene.start('GameScene');
    });
  }

  private startEditor() {
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.time.delayedCall(400, () => {
      this.scene.start('EditorScene');
    });
  }

  private showCustomLevelMenu(levels: any[]) {
    const { width: W, height: H } = this.scale;
    // 既存メニューを削除
    const existing = this.children.getByName('customMenu');
    if (existing) { existing.destroy(); return; }

    const container = this.add.container(W/2 - 150, H * 0.55).setDepth(50).setName('customMenu');
    const bg = this.add.graphics();
    bg.fillStyle(0x0e0c20, 0.95);
    bg.fillRoundedRect(0, 0, 300, Math.min(levels.length * 36 + 20, 200), 6);
    bg.lineStyle(1, 0x4433aa, 1);
    bg.strokeRoundedRect(0, 0, 300, Math.min(levels.length * 36 + 20, 200), 6);
    container.add(bg);

    levels.slice(0, 5).forEach((lvl: any, i: number) => {
      const btn = this.add.text(10, 10 + i * 36, `▶ ${lvl.name}`, {
        fontSize: '13px', fontFamily: 'monospace', color: '#ccaaff',
        backgroundColor: '#1a1540', padding: { x: 8, y: 4 },
      }).setInteractive({ cursor: 'pointer' });
      btn.on('pointerdown', () => {
        this.cameras.main.fadeOut(400, 0, 0, 0);
        this.time.delayedCall(400, () => {
          // カスタムレベルをパース → GameSceneへ
          const { LevelEditorState } = require('../systems/LevelEditorState');
          const state = new LevelEditorState();
          state.loadFromStorage(lvl.id);
          this.scene.start('GameScene', { customLevel: state.toLevelDef() });
        });
      });
      btn.on('pointerover', () => btn.setStyle({ color: '#ffffff' }));
      btn.on('pointerout',  () => btn.setStyle({ color: '#ccaaff' }));
      container.add(btn);
    });
  }

  private registerAnims() {
    const { AnimationManager } = require('../systems/AnimationManager');
    const mgr = new AnimationManager(this);
    mgr.registerAll();
  }
}
