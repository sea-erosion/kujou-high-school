/**
 * UIScene.ts
 * HUD overlay: HP bar, status effect icons, combo counter, boss HP
 */

import Phaser from 'phaser';
import { StatusType, STATUS_CONFIGS } from '../systems/StatusEffects';

export class UIScene extends Phaser.Scene {
  // HP
  private hpBg!: Phaser.GameObjects.Graphics;
  private hpFill!: Phaser.GameObjects.Graphics;
  private hpText!: Phaser.GameObjects.Text;
  private hpLabel!: Phaser.GameObjects.Text;

  // Status icons
  private statusContainer!: Phaser.GameObjects.Container;
  private statusIcons: Phaser.GameObjects.Text[] = [];

  // Combo
  private comboText!: Phaser.GameObjects.Text;
  private comboLabel!: Phaser.GameObjects.Text;
  private comboValue: number = 0;

  // Boss HP
  private bossHpBg!: Phaser.GameObjects.Graphics;
  private bossHpFill!: Phaser.GameObjects.Graphics;
  private bossHpText!: Phaser.GameObjects.Text;
  private bossHpLabel!: Phaser.GameObjects.Text;
  private bossHpContainer!: Phaser.GameObjects.Container;

  // Blind overlay
  private blindOverlay!: Phaser.GameObjects.Rectangle;

  // Pause / game over
  private overlayText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'UIScene' });
  }

  create() {
    const { width: W, height: H } = this.scale;

    // ── PLAYER HP BAR ────────────────────────

    const hpPanelGfx = this.add.graphics();
    hpPanelGfx.fillStyle(0x000000, 0.6);
    hpPanelGfx.fillRoundedRect(12, 12, 220, 44, 6);
    hpPanelGfx.lineStyle(1, 0x6644aa, 0.8);
    hpPanelGfx.strokeRoundedRect(12, 12, 220, 44, 6);

    this.hpLabel = this.add.text(20, 18, 'HP', {
      fontSize: '11px', fontFamily: 'monospace', color: '#aaaadd',
    });

    this.hpBg = this.add.graphics();
    this.hpBg.fillStyle(0x331111, 1);
    this.hpBg.fillRect(40, 22, 180, 12);

    this.hpFill = this.add.graphics();

    this.hpText = this.add.text(40, 36, '120 / 120', {
      fontSize: '10px', fontFamily: 'monospace', color: '#cccccc',
    });

    // ── STATUS EFFECT ICONS ──────────────────

    this.statusContainer = this.add.container(14, 62);

    // ── COMBO COUNTER ────────────────────────

    this.comboLabel = this.add.text(W - 12, 14, 'COMBO', {
      fontSize: '11px', fontFamily: 'monospace', color: '#aaaadd',
    }).setOrigin(1, 0).setAlpha(0);

    this.comboText = this.add.text(W - 12, 28, '0', {
      fontSize: '32px', fontFamily: 'monospace', color: '#ffee44',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(1, 0).setAlpha(0);

    // ── BOSS HP ──────────────────────────────

    this.bossHpBg = this.add.graphics();
    this.bossHpFill = this.add.graphics();
    this.bossHpLabel = this.add.text(W / 2, H - 42, '???', {
      fontSize: '12px', fontFamily: 'monospace', color: '#ff4444',
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setAlpha(0);
    this.bossHpText = this.add.text(W / 2, H - 18, '', {
      fontSize: '10px', fontFamily: 'monospace', color: '#cccccc',
    }).setOrigin(0.5).setAlpha(0);

    this.bossHpContainer = this.add.container(0, 0, [
      this.bossHpBg, this.bossHpFill, this.bossHpLabel, this.bossHpText
    ]);
    this.bossHpContainer.setAlpha(0);

    // ── BLIND OVERLAY ─────────────────────────

    this.blindOverlay = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0)
      .setDepth(50);

    // ── OVERLAY TEXT (game over / pause) ──────

    this.overlayText = this.add.text(W / 2, H / 2, '', {
      fontSize: '36px', fontFamily: 'monospace', color: '#ffffff',
      stroke: '#000000', strokeThickness: 6,
      align: 'center',
    }).setOrigin(0.5).setDepth(60).setAlpha(0);

    this.updateHP(120, 120);
    this.updateStatuses([]);

    // Listen from GameScene
    const gameScene = this.scene.get('GameScene') as any;
    gameScene?.events.on('hpChanged', (hp: number, maxHp: number) => this.updateHP(hp, maxHp));
    gameScene?.events.on('statusChanged', (statuses: StatusType[]) => this.updateStatuses(statuses));
    gameScene?.events.on('comboChanged', (count: number) => this.updateCombo(count));
    gameScene?.events.on('bossHpChanged', (hp: number, maxHp: number, name: string) => this.updateBossHP(hp, maxHp, name));
    gameScene?.events.on('playerDead', () => this.showGameOver());
    gameScene?.events.on('levelClear', () => this.showClear());
    gameScene?.events.on('blindChanged', (on: boolean) => this.setBlindOverlay(on));
  }

  // ─── HP ─────────────────────────────────────

  updateHP(hp: number, maxHp: number) {
    const W = 180;
    const fill = Math.max(0, (hp / maxHp) * W);
    this.hpFill.clear();
    const color = hp > maxHp * 0.5 ? 0x44ff66 : hp > maxHp * 0.25 ? 0xffaa00 : 0xff2222;
    this.hpFill.fillStyle(color, 1);
    this.hpFill.fillRect(40, 22, fill, 12);
    // Shine
    this.hpFill.fillStyle(0xffffff, 0.15);
    this.hpFill.fillRect(40, 22, fill, 4);
    this.hpText.setText(`${hp} / ${maxHp}`);

    // Flash on low HP
    if (hp <= maxHp * 0.25) {
      this.tweens.add({
        targets: this.hpFill,
        alpha: 0.5,
        duration: 200,
        yoyo: true,
        repeat: 1,
      });
    }
  }

  // ─── STATUSES ───────────────────────────────

  updateStatuses(statuses: StatusType[]) {
    // Clear old icons
    this.statusIcons.forEach(i => i.destroy());
    this.statusIcons = [];
    this.statusContainer.removeAll();

    statuses.forEach((status, i) => {
      const cfg = STATUS_CONFIGS[status];
      const icon = this.add.text(i * 26, 0, cfg.icon, {
        fontSize: '16px',
        backgroundColor: '#' + cfg.color.toString(16).padStart(6, '0') + '33',
        padding: { x: 3, y: 2 },
        stroke: '#000000',
        strokeThickness: 2,
      });
      this.statusIcons.push(icon);
      this.statusContainer.add(icon);
      // Pulse animation
      this.tweens.add({
        targets: icon,
        scaleX: 1.1, scaleY: 1.1,
        duration: 400,
        yoyo: true,
        repeat: -1,
        offset: i * 80,
      });
    });

    // Blind overlay
    this.setBlindOverlay(statuses.includes('blind'));
  }

  // ─── COMBO ──────────────────────────────────

  updateCombo(count: number) {
    this.comboValue = count;
    if (count === 0) {
      this.tweens.add({
        targets: [this.comboText, this.comboLabel],
        alpha: 0, duration: 300,
      });
      return;
    }

    this.comboLabel.setAlpha(1);
    this.comboText.setAlpha(1);
    this.comboText.setText(`${count}×`);

    const color = count >= 10 ? '#ff4444' : count >= 5 ? '#ff8800' : '#ffee44';
    const size = count >= 10 ? '42px' : count >= 5 ? '36px' : '32px';
    this.comboText.setStyle({ color, fontSize: size });

    // Pop animation
    this.tweens.add({
      targets: this.comboText,
      scaleX: 1.3, scaleY: 1.3,
      duration: 80,
      yoyo: true,
      ease: 'Power2',
    });
  }

  // ─── BOSS HP ────────────────────────────────

  updateBossHP(hp: number, maxHp: number, name: string) {
    const { width: W, height: H } = this.scale;
    const barW = W * 0.6;
    const barX = (W - barW) / 2;
    const barY = H - 30;

    this.bossHpContainer.setAlpha(1);
    this.bossHpLabel.setText(name).setAlpha(1);

    this.bossHpBg.clear();
    this.bossHpBg.fillStyle(0x000000, 0.7);
    this.bossHpBg.fillRect(barX - 4, barY - 22, barW + 8, 26);
    this.bossHpBg.lineStyle(1, 0xff2222, 0.8);
    this.bossHpBg.strokeRect(barX - 4, barY - 22, barW + 8, 26);

    const fill = Math.max(0, (hp / maxHp) * barW);
    this.bossHpFill.clear();
    this.bossHpFill.fillStyle(0xff2222, 1);
    this.bossHpFill.fillRect(barX, barY - 20, fill, 18);
    this.bossHpFill.fillStyle(0xffffff, 0.15);
    this.bossHpFill.fillRect(barX, barY - 20, fill, 6);

    this.bossHpText.setText(`${hp} / ${maxHp}`).setAlpha(1);

    if (hp <= 0) {
      this.tweens.add({
        targets: this.bossHpContainer,
        alpha: 0,
        duration: 800,
        delay: 1000,
      });
    }
  }

  // ─── BLIND ──────────────────────────────────

  setBlindOverlay(on: boolean) {
    this.tweens.add({
      targets: this.blindOverlay,
      alpha: on ? 0.85 : 0,
      duration: 300,
    });
  }

  // ─── GAME OVER / CLEAR ──────────────────────

  showGameOver() {
    const { width: W, height: H } = this.scale;

    // Dark overlay
    const overlay = this.add.rectangle(W/2, H/2, W, H, 0x000000, 0).setDepth(55);
    this.tweens.add({ targets: overlay, alpha: 0.7, duration: 600 });

    this.overlayText.setText('GAME OVER\n\n久条は倒れた…\n\n[ENTER] リトライ').setAlpha(0);
    this.tweens.add({ targets: this.overlayText, alpha: 1, duration: 500, delay: 600 });

    this.time.delayedCall(1200, () => {
      this.input.keyboard!.once('keydown-ENTER', () => {
        this.cameras.main.fadeOut(400, 0, 0, 0);
        this.time.delayedCall(400, () => {
          this.scene.stop('UIScene');
          this.scene.start('GameScene');
        });
      });
    });
  }

  showClear() {
    const { width: W, height: H } = this.scale;
    const overlay = this.add.rectangle(W/2, H/2, W, H, 0x000000, 0).setDepth(55);
    this.tweens.add({ targets: overlay, alpha: 0.5, duration: 600 });

    this.overlayText.setText('STAGE CLEAR!\n\n久条の勝利！\n\n[ENTER] タイトルへ').setStyle({ color: '#ffee44' }).setAlpha(0);
    this.tweens.add({ targets: this.overlayText, alpha: 1, duration: 500, delay: 600 });

    this.time.delayedCall(1200, () => {
      this.input.keyboard!.once('keydown-ENTER', () => {
        this.cameras.main.fadeOut(400, 0, 0, 0);
        this.time.delayedCall(400, () => {
          this.scene.stop('UIScene');
          this.scene.start('TitleScene');
        });
      });
    });
  }
}
