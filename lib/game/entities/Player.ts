/**
 * Player.ts
 * Full player entity: movement, umbrella system, combat, guard, status effects
 */

import { StatusEffectManager, StatusType } from '../systems/StatusEffects';

// ─── CONSTANTS ───────────────────────────────

const GRAVITY = 900;
const JUMP_VEL = -520;
const RUN_SPEED = 220;
const DASH_SPEED = 500;
const DASH_DURATION = 160;
const DASH_COOLDOWN = 500;
const ROLL_SPEED = 300;
const ROLL_DURATION = 300;
const ROLL_COOLDOWN = 800;
const ATTACK_COOLDOWN = 200;
const MAX_HP = 120;
const GUARD_BREAK_THRESHOLD = 40; // total blocked before guard breaks

// ─── TYPES ───────────────────────────────────

export type AttackDir = 'forward' | 'up' | 'down';
export type AttackPhase = 'none' | 'windup' | 'swing' | 'impact' | 'recovery';

export interface AttackHitbox {
  x: number; y: number; w: number; h: number;
  damage: number;
  active: boolean;
  dir: AttackDir;
  isFinisher: boolean;
}

// ─── PLAYER CLASS ────────────────────────────

export class Player {
  public sprite: Phaser.Physics.Arcade.Sprite;
  public hp: number = MAX_HP;
  public maxHp: number = MAX_HP;
  public isDead: boolean = false;

  // Physics body reference
  private body: Phaser.Physics.Arcade.Body;

  // State flags
  private onGround: boolean = false;
  private facing: number = 1; // 1 = right, -1 = left

  // Dash
  private dashing: boolean = false;
  private dashTimer: number = 0;
  private dashCooldownTimer: number = 0;
  private dashVelX: number = 0;

  // Roll
  private rolling: boolean = false;
  private rollTimer: number = 0;
  private rollCooldownTimer: number = 0;
  private rollInvincible: boolean = false;

  // Attack
  private attacking: boolean = false;
  private attackPhase: AttackPhase = 'none';
  private attackDir: AttackDir = 'forward';
  private attackTimer: number = 0;
  private attackCooldownTimer: number = 0;
  private isFinisher: boolean = false;
  public hitbox: AttackHitbox = { x:0,y:0,w:0,h:0,damage:0,active:false,dir:'forward',isFinisher:false };

  // Guard
  private guarding: boolean = false;
  private guardBlockedTotal: number = 0;
  private guardBroken: boolean = false;
  private guardBreakTimer: number = 0;

  // Jump
  private jumpCount: number = 0;
  private maxJumps: number = 2;

  // Hurt / invincibility
  private invincible: boolean = false;
  private invincibleTimer: number = 0;
  private hurtTimer: number = 0;

  // Combo
  private comboCount: number = 0;
  private comboTimer: number = 0;

  // Status
  public statusEffects: StatusEffectManager;

  // Umbrella visual
  private umbrellaSprite: Phaser.GameObjects.Graphics;

  // Scene reference
  private scene: Phaser.Scene;

  // Controls
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;

  // UI callback
  public onHpChanged?: (hp: number, maxHp: number) => void;
  public onComboChanged?: (count: number) => void;
  public onStatusChanged?: (statuses: StatusType[]) => void;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;

    // Create sprite
    this.sprite = scene.physics.add.sprite(x, y, 'player');
    this.sprite.setScale(2);
    this.sprite.setDepth(10);

    this.body = this.sprite.body as Phaser.Physics.Arcade.Body;
    this.body.setSize(14, 30);
    this.body.setOffset(9, 18);
    this.body.setMaxVelocityX(600);
    this.body.setGravityY(GRAVITY - 900); // scene gravity handles base

    // Umbrella overlay graphic
    this.umbrellaSprite = scene.add.graphics();
    this.umbrellaSprite.setDepth(11);

    // Status effects
    this.statusEffects = new StatusEffectManager(
      scene,
      this.sprite,
      (dmg) => this.takeDamage(dmg, false),
      () => this.triggerStun()
    );

    // Input
    this.cursors = scene.input.keyboard!.createCursorKeys();
    this.keys = {
      w: scene.input.keyboard!.addKey('W'),
      a: scene.input.keyboard!.addKey('A'),
      s: scene.input.keyboard!.addKey('S'),
      d: scene.input.keyboard!.addKey('D'),
      z: scene.input.keyboard!.addKey('Z'),
      x: scene.input.keyboard!.addKey('X'),
      c: scene.input.keyboard!.addKey('C'),
      shift: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT),
      space: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
    };
  }

  // ─── INPUT HELPERS ──────────────────────────

  private isLeft(): boolean {
    const inv = this.statusEffects.reversedControls();
    const raw = this.cursors.left.isDown || this.keys.a.isDown;
    return inv ? !raw && (this.cursors.right.isDown || this.keys.d.isDown) : raw;
  }

  private isRight(): boolean {
    const inv = this.statusEffects.reversedControls();
    const raw = this.cursors.right.isDown || this.keys.d.isDown;
    return inv ? !raw && (this.cursors.left.isDown || this.keys.a.isDown) : raw;
  }

  private isUp(): boolean {
    return this.cursors.up.isDown || this.keys.w.isDown;
  }

  private isDown(): boolean {
    return this.cursors.down.isDown || this.keys.s.isDown;
  }

  private isJumpPressed(): boolean {
    return Phaser.Input.Keyboard.JustDown(this.keys.space) ||
           Phaser.Input.Keyboard.JustDown(this.cursors.up);
  }

  private isDashPressed(): boolean {
    return Phaser.Input.Keyboard.JustDown(this.keys.shift);
  }

  private isAttackPressed(): boolean {
    return Phaser.Input.Keyboard.JustDown(this.keys.z);
  }

  private isGuardDown(): boolean {
    return this.keys.x.isDown;
  }

  private isFinisherPressed(): boolean {
    return Phaser.Input.Keyboard.JustDown(this.keys.c);
  }

  // ─── MAIN UPDATE ────────────────────────────

  update(time: number, delta: number) {
    if (this.isDead) return;

    const dt = delta / 1000;
    this.onGround = this.body.blocked.down;

    // Tick status effects
    this.statusEffects.update(time);

    // Timer countdowns
    if (this.dashCooldownTimer > 0) this.dashCooldownTimer -= delta;
    if (this.rollCooldownTimer > 0) this.rollCooldownTimer -= delta;
    if (this.attackCooldownTimer > 0) this.attackCooldownTimer -= delta;
    if (this.invincibleTimer > 0) {
      this.invincibleTimer -= delta;
      if (this.invincibleTimer <= 0) {
        this.invincible = false;
        this.sprite.clearTint();
        this.statusEffects['applyVisualTint']?.();
      }
    }
    if (this.hurtTimer > 0) {
      this.hurtTimer -= delta;
    }
    if (this.guardBreakTimer > 0) {
      this.guardBreakTimer -= delta;
      if (this.guardBreakTimer <= 0) {
        this.guardBroken = false;
        this.guardBlockedTotal = 0;
      }
    }
    if (this.comboTimer > 0) {
      this.comboTimer -= delta;
      if (this.comboTimer <= 0) {
        this.comboCount = 0;
        this.onComboChanged?.(0);
      }
    }

    // Active state processing
    if (this.dashing) {
      this.processDash(delta);
    } else if (this.rolling) {
      this.processRoll(delta);
    } else if (this.attacking) {
      this.processAttack(delta);
    } else if (this.hurtTimer > 0) {
      // Hurt stagger - minimal control
      this.applyFriction(dt, 0.7);
    } else {
      // Normal control
      this.processMovement(dt);
      this.processActions(time);
    }

    // Update facing & flip
    this.updateFacing();

    // Update umbrella visual
    this.updateUmbrellaVisual();

    // Ground reset jump
    if (this.onGround) {
      this.jumpCount = 0;
    }

    // Hitbox position update
    this.updateHitbox();
  }

  // ─── MOVEMENT ───────────────────────────────

  private processMovement(dt: number) {
    if (!this.statusEffects.canMove()) {
      this.applyFriction(dt, 0.8);
      this.setAnim('player_idle');
      return;
    }

    const speedMult = this.statusEffects.getSpeedMultiplier();
    const speed = RUN_SPEED * speedMult;
    let moving = false;

    if (this.isLeft()) {
      this.body.setVelocityX(-speed);
      moving = true;
    } else if (this.isRight()) {
      this.body.setVelocityX(speed);
      moving = true;
    } else {
      this.applyFriction(dt, 0.85);
    }

    // Jump
    if (this.isJumpPressed() && this.jumpCount < this.maxJumps) {
      this.body.setVelocityY(JUMP_VEL);
      this.jumpCount++;
      try { this.scene.sound.play('sfx_jump', { volume: 0.5 }); } catch(_){};
    }

    // Animation selection
    if (!this.onGround) {
      this.setAnim('player_jump');
    } else if (moving) {
      this.setAnim('player_run');
    } else if (this.isDown()) {
      this.setAnim('player_idle'); // crouch (no separate anim, use idle)
    } else {
      this.setAnim('player_idle');
    }
  }

  private applyFriction(dt: number, factor: number) {
    const vx = this.body.velocity.x;
    this.body.setVelocityX(vx * Math.pow(factor, dt * 60));
  }

  // ─── ACTIONS ────────────────────────────────

  private processActions(time: number) {
    // Finisher (highest priority)
    if (this.isFinisherPressed() && this.attackCooldownTimer <= 0 && this.statusEffects.canAttack()) {
      this.startAttack('forward', true);
      return;
    }

    // Guard
    const guarding = this.isGuardDown() && !this.guardBroken;
    if (guarding !== this.guarding) {
      this.guarding = guarding;
      if (guarding) {
        this.setAnim('player_guard');
        this.body.setVelocityX(this.body.velocity.x * 0.3);
      }
    }
    if (this.guarding) {
      this.setAnim('player_guard');
      return;
    }

    // Dash
    if (this.isDashPressed() && this.dashCooldownTimer <= 0) {
      this.startDash();
      return;
    }

    // Roll (down + shift or just C while dashing)
    if (this.isDown() && this.isDashPressed() && this.rollCooldownTimer <= 0) {
      this.startRoll();
      return;
    }

    // Attack
    if (this.isAttackPressed() && this.attackCooldownTimer <= 0 && this.statusEffects.canAttack()) {
      const dir: AttackDir = this.isUp() ? 'up' : this.isDown() ? 'down' : 'forward';
      this.startAttack(dir, false);
    }
  }

  // ─── DASH ───────────────────────────────────

  private startDash() {
    this.dashing = true;
    this.dashTimer = DASH_DURATION;
    this.dashCooldownTimer = DASH_COOLDOWN;
    this.dashVelX = DASH_SPEED * this.facing;
    this.setInvincible(80);
    this.setAnim('player_dash');
    try { this.scene.sound.play('sfx_dash', { volume: 0.4 }); } catch(_){};
  }

  private processDash(delta: number) {
    this.dashTimer -= delta;
    this.body.setVelocityX(this.dashVelX);
    if (this.dashTimer <= 0) {
      this.dashing = false;
      this.body.setVelocityX(this.facing * 80);
    }
  }

  // ─── ROLL ───────────────────────────────────

  private startRoll() {
    this.rolling = true;
    this.rollTimer = ROLL_DURATION;
    this.rollCooldownTimer = ROLL_COOLDOWN;
    this.rollInvincible = true;
    this.setInvincible(ROLL_DURATION);
    this.setAnim('player_roll');
    try { this.scene.sound.play('sfx_dash', { volume: 0.3 }); } catch(_){};
  }

  private processRoll(delta: number) {
    this.rollTimer -= delta;
    this.body.setVelocityX(this.facing * ROLL_SPEED);
    if (this.rollTimer <= 0) {
      this.rolling = false;
      this.rollInvincible = false;
    }
  }

  // ─── ATTACK ─────────────────────────────────

  private startAttack(dir: AttackDir, finisher: boolean) {
    this.attacking = true;
    this.attackDir = dir;
    this.isFinisher = finisher;
    this.attackPhase = 'windup';
    this.attackTimer = finisher ? 80 : 60;
    this.attackCooldownTimer = finisher ? 600 : ATTACK_COOLDOWN;
    this.hitbox.active = false;

    const anim = finisher ? 'player_finisher'
      : dir === 'up' ? 'player_atk_up'
      : dir === 'down' ? 'player_atk_dn'
      : 'player_atk_fwd';
    this.setAnim(anim);

    // Slow on attack
    this.body.setVelocityX(this.body.velocity.x * 0.4);
    try { this.scene.sound.play('sfx_swing', { volume: 0.5 }); } catch(_){};
  }

  private processAttack(delta: number) {
    this.attackTimer -= delta;

    if (this.attackTimer <= 0) {
      switch (this.attackPhase) {
        case 'windup':
          this.attackPhase = 'swing';
          this.attackTimer = this.isFinisher ? 100 : 80;
          break;
        case 'swing':
          this.attackPhase = 'impact';
          this.attackTimer = 60;
          this.hitbox.active = true;
          this.hitbox.damage = this.isFinisher ? 30 : (this.attackDir === 'forward' ? 12 : 10);
          this.hitbox.dir = this.attackDir;
          this.hitbox.isFinisher = this.isFinisher;
          // Combo tracking
          this.comboCount++;
          this.comboTimer = 800;
          this.onComboChanged?.(this.comboCount);
          break;
        case 'impact':
          this.attackPhase = 'recovery';
          this.attackTimer = this.isFinisher ? 120 : 80;
          this.hitbox.active = false;
          if (this.isFinisher) {
            try { this.scene.sound.play('sfx_impact', { volume: 0.7 }); } catch(_){};
          }
          break;
        case 'recovery':
          this.attackPhase = 'none';
          this.attacking = false;
          break;
      }
    }
  }

  private updateHitbox() {
    if (!this.hitbox.active) return;
    const bx = this.sprite.x;
    const by = this.sprite.y;
    const scale = 2;

    if (this.attackDir === 'forward') {
      this.hitbox.x = bx + this.facing * 20 * scale;
      this.hitbox.y = by - 4;
      this.hitbox.w = 28 * scale;
      this.hitbox.h = 20;
    } else if (this.attackDir === 'up') {
      this.hitbox.x = bx;
      this.hitbox.y = by - 36;
      this.hitbox.w = 24;
      this.hitbox.h = 28 * scale;
    } else {
      this.hitbox.x = bx;
      this.hitbox.y = by + 12;
      this.hitbox.w = 24;
      this.hitbox.h = 28 * scale;
    }
    if (this.isFinisher) {
      this.hitbox.w *= 1.5;
      this.hitbox.h *= 1.5;
    }
  }

  // ─── GUARD ──────────────────────────────────

  /** Returns true if attack was blocked */
  tryBlock(damage: number): boolean {
    if (!this.guarding || this.guardBroken || this.rolling) return false;

    this.guardBlockedTotal += damage;

    // Spawn guard FX
    this.spawnFX('fx_guard', this.sprite.x + this.facing * 30, this.sprite.y);

    if (this.guardBlockedTotal >= GUARD_BREAK_THRESHOLD) {
      this.breakGuard();
      return false; // guard just broke, damage goes through
    }
    try { this.scene.sound.play('sfx_guard', { volume: 0.5 }); } catch(_){};
    return true;
  }

  private breakGuard() {
    this.guardBroken = true;
    this.guardBreakTimer = 1200;
    this.guarding = false;
    this.hurtTimer = 400;
    try { this.scene.sound.play('sfx_hurt', { volume: 0.6 }); } catch(_){};
    // Camera shake
    this.scene.cameras.main.shake(200, 0.01);
  }

  // ─── DAMAGE / DEATH ─────────────────────────

  takeDamage(amount: number, knockback: boolean = true, sourceX?: number) {
    if (this.invincible || this.isDead) return;
    if (this.tryBlock(amount)) return;

    this.hp = Math.max(0, this.hp - amount);
    this.onHpChanged?.(this.hp, this.maxHp);

    if (knockback) {
      const dir = sourceX !== undefined ? (this.sprite.x > sourceX ? 1 : -1) : -this.facing;
      this.body.setVelocityX(dir * 200);
      this.body.setVelocityY(-120);
    }

    this.hurtTimer = 250;
    this.setInvincible(500);
    this.setAnim('player_hurt');
    try { this.scene.sound.play('sfx_hurt', { volume: 0.5 }); } catch(_){};
    this.scene.cameras.main.shake(80, 0.006);

    if (this.hp <= 0) {
      this.die();
    }
  }

  private die() {
    this.isDead = true;
    this.body.setVelocityX(0);
    this.hitbox.active = false;
    this.setAnim('player_death');
    try { this.scene.sound.play('sfx_hurt', { volume: 0.7 }); } catch(_){};
  }

  heal(amount: number) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
    this.onHpChanged?.(this.hp, this.maxHp);
  }

  private setInvincible(duration: number) {
    this.invincible = true;
    this.invincibleTimer = Math.max(this.invincibleTimer, duration);
    // Flicker
    this.scene.tweens.add({
      targets: this.sprite,
      alpha: 0.4,
      duration: 80,
      yoyo: true,
      repeat: Math.floor(duration / 160),
      onComplete: () => { this.sprite.setAlpha(1); },
    });
  }

  private triggerStun() {
    if (this.invincible) return;
    this.attacking = false;
    this.hurtTimer = 400;
    this.setAnim('player_hurt');
  }

  // ─── FACING ─────────────────────────────────

  private updateFacing() {
    const vx = this.body.velocity.x;
    if (!this.dashing) {
      if (this.isRight()) this.facing = 1;
      else if (this.isLeft()) this.facing = -1;
    }
    this.sprite.setFlipX(this.facing < 0);
  }

  // ─── UMBRELLA VISUAL ────────────────────────

  private updateUmbrellaVisual() {
    this.umbrellaSprite.clear();
    const x = this.sprite.x;
    const y = this.sprite.y;
    const f = this.facing;
    const scale = 2;

    if (this.guarding) {
      // Open umbrella shield
      this.umbrellaSprite.fillStyle(0x222244, 0.8);
      this.umbrellaSprite.fillEllipse(x + f * 28, y - 6, 50, 40);
      this.umbrellaSprite.lineStyle(2, 0x6688cc, 1);
      this.umbrellaSprite.strokeEllipse(x + f * 28, y - 6, 52, 42);
      // Ribs
      for (let i = 0; i < 6; i++) {
        const angle = (-90 + i * 36) * Math.PI / 180;
        this.umbrellaSprite.lineStyle(1, 0x4466aa, 0.6);
        this.umbrellaSprite.lineBetween(
          x + f * 28, y - 6,
          x + f * 28 + Math.cos(angle) * 24,
          y - 6 + Math.sin(angle) * 18
        );
      }
    } else if (this.dashing || this.rolling) {
      // Trailing umbrella
      for (let t = 0; t < 3; t++) {
        this.umbrellaSprite.fillStyle(0x111122, 0.4 - t * 0.1);
        this.umbrellaSprite.fillRect(x - f * (16 + t * 6), y - 10 - t, 6, 20);
      }
    } else if (this.attacking) {
      // Closed attack umbrella
      if (this.attackPhase === 'impact' || this.attackPhase === 'swing') {
        if (this.attackDir === 'forward') {
          this.umbrellaSprite.fillStyle(0x111122, 1);
          this.umbrellaSprite.fillRect(x + f * 12, y - 4, f * 40, 4);
          this.umbrellaSprite.fillStyle(0x3344aa, 1);
          this.umbrellaSprite.fillRect(x + f * 48, y - 8, f * 6, 12);
          if (this.attackPhase === 'impact') {
            // Impact flash
            this.umbrellaSprite.fillStyle(0xffee44, 0.9);
            this.umbrellaSprite.fillCircle(x + f * 54, y - 2, 8);
          }
        } else if (this.attackDir === 'up') {
          this.umbrellaSprite.fillStyle(0x111122, 1);
          this.umbrellaSprite.fillRect(x - 2, y - 20, 4, -32);
          this.umbrellaSprite.fillStyle(0x3344aa, 1);
          this.umbrellaSprite.fillEllipse(x, y - 56, 20, 10);
        } else {
          this.umbrellaSprite.fillStyle(0x111122, 1);
          this.umbrellaSprite.fillRect(x - 2, y + 10, 4, 32);
          this.umbrellaSprite.fillStyle(0x3344aa, 1);
          this.umbrellaSprite.fillEllipse(x, y + 46, 20, 10);
        }
      }
    } else {
      // Trailing umbrella (idle/run)
      const time = this.scene.time.now;
      const lag = Math.sin(time * 0.006) * 4;
      this.umbrellaSprite.fillStyle(0x111122, 0.9);
      this.umbrellaSprite.fillRect(x - f * 14 + lag * f, y - 6, 3, 20);
      this.umbrellaSprite.fillStyle(0x334466, 0.9);
      this.umbrellaSprite.fillRect(x - f * 18 + lag * f * 2, y - 8, 10, 4);
    }
  }

  // ─── HELPERS ────────────────────────────────

  private setAnim(key: string) {
    if (this.sprite.anims.currentAnim?.key !== key) {
      this.sprite.play(key, true);
    }
  }

  private spawnFX(animKey: string, x: number, y: number) {
    const fx = this.scene.add.sprite(x, y, 'fx');
    fx.setDepth(20);
    fx.play(animKey);
    fx.on('animationcomplete', () => fx.destroy());
  }

  // ─── FINISHER HIT EFFECT ─────────────────────

  triggerFinisherEffect() {
    this.scene.cameras.main.shake(300, 0.015);
    this.spawnFX('fx_finish', this.sprite.x + this.facing * 60, this.sprite.y);
    // Slow-mo effect
    this.scene.time.timeScale = 0.15;
    this.scene.time.delayedCall(200, () => { this.scene.time.timeScale = 1; });
  }

  // Public getters
  get x() { return this.sprite.x; }
  get y() { return this.sprite.y; }
  get facingDir() { return this.facing; }
  get isGuarding() { return this.guarding; }
  get isRolling() { return this.rolling; }
  get isDashing() { return this.dashing; }
  get isAttacking() { return this.attacking; }
  get isInvincible() { return this.invincible; }
}
