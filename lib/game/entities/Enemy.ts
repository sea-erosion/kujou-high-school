/**
 * Enemy.ts
 * Enemy base class + two enemy types: Thug and GangBoss
 * AI states: patrol, alert, chase, attack, hurt, dead
 */

import { StatusEffectManager, StatusType } from '../systems/StatusEffects';

// ─── AI STATES ───────────────────────────────

export type AIState = 'patrol' | 'alert' | 'chase' | 'attack' | 'stunned' | 'hurt' | 'dead';

// ─── BASE ENEMY ──────────────────────────────

export abstract class Enemy {
  public sprite: Phaser.Physics.Arcade.Sprite;
  public hp: number;
  public maxHp: number;
  public isDead: boolean = false;
  public isBoss: boolean = false;

  protected body: Phaser.Physics.Arcade.Body;
  protected scene: Phaser.Scene;
  protected state: AIState = 'patrol';
  protected facing: number = -1;
  protected stateTimer: number = 0;
  protected alertTimer: number = 0;
  protected attackCooldown: number = 0;

  // Patrol
  protected patrolLeft: number;
  protected patrolRight: number;
  protected patrolDir: number = -1;

  // Combat
  public hitbox: { x:number; y:number; w:number; h:number; damage:number; active:boolean } =
    { x:0, y:0, w:0, h:0, damage:0, active:false };

  // Stats
  protected speed: number = 80;
  protected attackRange: number = 60;
  protected detectionRange: number = 300;
  protected attackDuration: number = 500;
  protected attackDamage: number = 12;
  protected hurtDuration: number = 300;

  // Status
  public statusEffects: StatusEffectManager;

  // UI
  private hpBar?: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, x: number, y: number, hp: number, textureKey: string) {
    this.scene = scene;
    this.hp = hp;
    this.maxHp = hp;
    this.patrolLeft = x - 120;
    this.patrolRight = x + 120;

    this.sprite = scene.physics.add.sprite(x, y, textureKey);
    this.sprite.setScale(2);
    this.sprite.setDepth(9);
    this.body = this.sprite.body as Phaser.Physics.Arcade.Body;
    this.body.setSize(14, 30);
    this.body.setOffset(9, 18);

    this.statusEffects = new StatusEffectManager(
      scene, this.sprite,
      (dmg) => this.takeDamage(dmg, false),
      () => this.enterState('stunned')
    );

    // HP bar
    this.hpBar = scene.add.graphics();
    this.hpBar.setDepth(15);
  }

  // ─── STATE MACHINE ───────────────────────────

  protected enterState(state: AIState) {
    this.state = state;
    this.stateTimer = 0;
    switch (state) {
      case 'patrol':   this.onPatrolEnter(); break;
      case 'alert':    this.onAlertEnter(); break;
      case 'chase':    this.onChaseEnter(); break;
      case 'attack':   this.onAttackEnter(); break;
      case 'stunned':  this.onStunnedEnter(); break;
      case 'hurt':     this.onHurtEnter(); break;
      case 'dead':     this.onDeadEnter(); break;
    }
  }

  protected onPatrolEnter()  { this.playAnim(this.idleAnim()); }
  protected onAlertEnter()   { this.playAnim(this.idleAnim()); this.stateTimer = 600; }
  protected onChaseEnter()   { this.playAnim(this.runAnim()); }
  protected onAttackEnter()  { this.playAnim(this.attackAnim()); this.stateTimer = this.attackDuration; }
  protected onStunnedEnter() { this.playAnim(this.hurtAnim()); this.stateTimer = 800; this.body.setVelocityX(0); }
  protected onHurtEnter()    { this.playAnim(this.hurtAnim()); this.stateTimer = this.hurtDuration; }
  protected onDeadEnter()    {
    this.isDead = true;
    this.hitbox.active = false;
    this.body.setVelocityX(0);
    this.body.setEnable(false);
    this.playAnim(this.deathAnim());
    this.statusEffects.removeAll();
    this.scene.time.delayedCall(1500, () => {
      this.sprite.destroy();
      this.hpBar?.destroy();
    });
  }

  // ─── ABSTRACT ANIM NAMES ────────────────────

  protected abstract idleAnim(): string;
  protected abstract runAnim(): string;
  protected abstract attackAnim(): string;
  protected abstract hurtAnim(): string;
  protected abstract deathAnim(): string;

  // ─── MAIN UPDATE ────────────────────────────

  update(time: number, delta: number, playerX: number, playerY: number) {
    if (this.isDead) return;

    this.statusEffects.update(time);
    this.stateTimer -= delta;
    if (this.attackCooldown > 0) this.attackCooldown -= delta;

    const dx = playerX - this.sprite.x;
    const dy = playerY - this.sprite.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    const inRange = dist < this.detectionRange;

    switch (this.state) {
      case 'patrol':
        this.updatePatrol(delta);
        if (inRange) this.enterState('alert');
        break;

      case 'alert':
        this.body.setVelocityX(0);
        if (this.stateTimer <= 0) this.enterState('chase');
        break;

      case 'chase':
        this.updateChase(dx, dy, dist);
        if (!inRange) { this.enterState('patrol'); break; }
        if (Math.abs(dx) < this.attackRange && this.attackCooldown <= 0) {
          this.enterState('attack');
        }
        break;

      case 'attack':
        this.updateAttack(delta, dx, dy);
        if (this.stateTimer <= 0) {
          this.hitbox.active = false;
          this.attackCooldown = this.getAttackCooldown();
          this.enterState('chase');
        }
        break;

      case 'stunned':
        if (this.stateTimer <= 0) this.enterState('chase');
        break;

      case 'hurt':
        if (this.stateTimer <= 0) this.enterState(inRange ? 'chase' : 'patrol');
        break;
    }

    // Status movement modifiers
    if (!this.statusEffects.canMove() || this.state === 'stunned') {
      this.body.setVelocityX(0);
    }

    this.updateFacing();
    this.updateHPBar();
  }

  protected updatePatrol(delta: number) {
    const spd = this.speed * 0.5 * this.statusEffects.getSpeedMultiplier();
    this.body.setVelocityX(this.patrolDir * spd);

    if (this.sprite.x <= this.patrolLeft) {
      this.patrolDir = 1;
      this.playAnim(this.runAnim());
    } else if (this.sprite.x >= this.patrolRight) {
      this.patrolDir = -1;
      this.playAnim(this.runAnim());
    }

    // Random idle pause
    if (Math.random() < 0.001) {
      this.body.setVelocityX(0);
      this.playAnim(this.idleAnim());
    }
  }

  protected updateChase(dx: number, dy: number, dist: number) {
    if (!this.statusEffects.canMove()) return;
    const spd = this.speed * this.statusEffects.getSpeedMultiplier();
    const dirX = dx > 0 ? 1 : -1;
    this.body.setVelocityX(dirX * spd);
    this.playAnim(this.runAnim());
  }

  protected updateAttack(delta: number, dx: number, dy: number) {
    // Activate hitbox in middle of attack window
    const progress = 1 - (this.stateTimer / this.attackDuration);
    if (progress > 0.3 && progress < 0.6) {
      this.hitbox.active = true;
      this.hitbox.damage = this.attackDamage;
      this.hitbox.x = this.sprite.x + this.facing * 30;
      this.hitbox.y = this.sprite.y - 10;
      this.hitbox.w = 30;
      this.hitbox.h = 30;
    } else {
      this.hitbox.active = false;
    }
  }

  protected getAttackCooldown(): number { return 1500; }

  // ─── TAKE DAMAGE ─────────────────────────────

  takeDamage(amount: number, knockback: boolean = true, sourceX?: number, status?: StatusType) {
    if (this.isDead) return;

    this.hp = Math.max(0, this.hp - amount);

    if (knockback) {
      const kbDir = sourceX !== undefined ? (this.sprite.x > sourceX ? 1 : -1) : 1;
      this.body.setVelocityX(kbDir * 150);
      this.body.setVelocityY(-80);
    }

    if (status) {
      this.statusEffects.apply(status);
    }

    // Spawn damage number
    this.spawnDmgNumber(amount);

    if (this.hp <= 0) {
      this.enterState('dead');
    } else {
      this.enterState('hurt');
    }
  }

  private spawnDmgNumber(amount: number) {
    const colors: Record<string, string> = { '1':'#ff4444', '2':'#ff6600', '3':'#ffcc00' };
    const tier = amount > 20 ? '3' : amount > 10 ? '2' : '1';
    const txt = this.scene.add.text(
      this.sprite.x + Phaser.Math.Between(-10, 10),
      this.sprite.y - 20,
      `-${amount}`,
      { fontSize: amount > 20 ? '18px' : '14px', color: colors[tier], fontFamily: 'monospace', stroke: '#000', strokeThickness: 3 }
    );
    txt.setDepth(30);
    this.scene.tweens.add({
      targets: txt,
      y: txt.y - 40,
      alpha: 0,
      duration: 700,
      ease: 'Power2',
      onComplete: () => txt.destroy(),
    });
  }

  // ─── FACING ─────────────────────────────────

  private updateFacing() {
    const vx = this.body.velocity.x;
    if (vx > 10) { this.facing = 1; this.sprite.setFlipX(false); }
    else if (vx < -10) { this.facing = -1; this.sprite.setFlipX(true); }
  }

  // ─── HP BAR ─────────────────────────────────

  private updateHPBar() {
    if (!this.hpBar || this.isDead) return;
    this.hpBar.clear();
    const bx = this.sprite.x - 20;
    const by = this.sprite.y - 52;
    const w = 40;
    const h = 4;
    const fill = (this.hp / this.maxHp) * w;
    this.hpBar.fillStyle(0x331111, 0.8);
    this.hpBar.fillRect(bx, by, w, h);
    const color = this.hp > this.maxHp * 0.5 ? 0x44ff44 : this.hp > this.maxHp * 0.25 ? 0xffaa00 : 0xff2222;
    this.hpBar.fillStyle(color, 1);
    this.hpBar.fillRect(bx, by, fill, h);
    this.hpBar.lineStyle(1, 0x888888, 0.6);
    this.hpBar.strokeRect(bx, by, w, h);
  }

  protected playAnim(key: string) {
    if (this.sprite.anims.currentAnim?.key !== key) {
      this.sprite.play(key, true);
    }
  }

  get x() { return this.sprite.x; }
  get y() { return this.sprite.y; }
}

// ─── THUG ────────────────────────────────────

export class Thug extends Enemy {
  constructor(scene: Phaser.Scene, x: number, y: number, variant: 'blue' | 'red' = 'blue') {
    super(scene, x, y, 50, 'enemy');
    this.speed = 90;
    this.attackRange = 55;
    this.attackDamage = 10;
    this.attackDuration = 500;
    if (variant === 'red') {
      this.speed = 110;
      this.attackDamage = 12;
    }
    this.body.setSize(14, 28);
    this.body.setOffset(9, 20);
    this.enterState('patrol');
  }

  protected idleAnim()   { return 'thug_idle'; }
  protected runAnim()    { return 'thug_run'; }
  protected attackAnim() { return 'thug_atk'; }
  protected hurtAnim()   { return 'thug_hurt'; }
  protected deathAnim()  { return 'thug_death'; }
  protected getAttackCooldown() { return 1200; }
}

// ─── GANG BOSS ───────────────────────────────

export class GangBoss extends Enemy {
  private phase: number = 1; // 1, 2
  private enrageThreshold: number = 0.4;
  private enraged: boolean = false;
  private chargeTimer: number = 0;
  private charging: boolean = false;
  private chargeTarget: number = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 200, 'enemy');
    this.isBoss = true;
    this.speed = 70;
    this.attackRange = 70;
    this.attackDamage = 22;
    this.attackDuration = 700;
    this.detectionRange = 450;
    this.hurtDuration = 200; // Boss shrugs off hits faster
    this.body.setSize(18, 34);
    this.body.setOffset(7, 14);
    this.sprite.setScale(2.5);
    this.enterState('patrol');
  }

  protected idleAnim()   { return 'boss_idle'; }
  protected runAnim()    { return 'boss_run'; }
  protected attackAnim() { return 'boss_atk'; }
  protected hurtAnim()   { return 'boss_hurt'; }
  protected deathAnim()  { return 'boss_death'; }
  protected getAttackCooldown() { return this.enraged ? 800 : 1500; }

  update(time: number, delta: number, playerX: number, playerY: number) {
    if (this.isDead) return;

    // Phase transition
    if (!this.enraged && this.hp / this.maxHp <= this.enrageThreshold) {
      this.enrage();
    }

    // Charge attack logic
    if (this.charging) {
      this.chargeTimer -= delta;
      this.body.setVelocityX(this.facing * 350);
      if (
        this.chargeTimer <= 0 ||
        Math.abs(this.sprite.x - this.chargeTarget) < 20
      ) {
        this.charging = false;
        this.body.setVelocityX(0);
        this.hitbox.active = false;
        this.attackCooldown = 1200;
        this.enterState('chase');
      } else {
        this.hitbox.active = true;
        this.hitbox.damage = 28;
        this.hitbox.x = this.sprite.x + this.facing * 30;
        this.hitbox.y = this.sprite.y - 10;
        this.hitbox.w = 40;
        this.hitbox.h = 36;
      }
      this.statusEffects.update(time);
      return;
    }

    super.update(time, delta, playerX, playerY);

    // Boss special: charge attack
    if (this.state === 'chase' && this.attackCooldown <= 0) {
      const dist = Math.abs(playerX - this.sprite.x);
      if (dist > 100 && dist < 300 && Math.random() < 0.005) {
        this.startCharge(playerX);
      }
    }
  }

  protected updateAttack(delta: number, dx: number, dy: number) {
    super.updateAttack(delta, dx, dy);
  }

  private startCharge(targetX: number) {
    this.charging = true;
    this.chargeTimer = 500;
    this.chargeTarget = targetX;
    this.facing = targetX > this.sprite.x ? 1 : -1;
    this.sprite.setFlipX(this.facing < 0);
    this.playAnim(this.runAnim());
    this.scene.cameras.main.shake(100, 0.005);
  }

  private enrage() {
    this.enraged = true;
    this.speed = 120;
    this.attackDamage = 30;
    this.sprite.setTint(0xff3300);
    // Flash effect
    this.scene.cameras.main.flash(300, 200, 50, 0);
    this.scene.cameras.main.shake(300, 0.01);
    // Spawn enrage text
    const txt = this.scene.add.text(this.sprite.x, this.sprite.y - 60, '激昂！', {
      fontSize: '24px', color: '#ff2200', fontFamily: 'monospace',
      stroke: '#000', strokeThickness: 4
    }).setDepth(30);
    this.scene.tweens.add({
      targets: txt, y: txt.y - 50, alpha: 0, duration: 1000,
      onComplete: () => txt.destroy()
    });
  }
}
