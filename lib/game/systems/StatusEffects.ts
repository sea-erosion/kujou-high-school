/**
 * StatusEffects.ts
 * Manages all 9 status effects: visual layers + gameplay modifiers
 */

export type StatusType =
  | 'poison'
  | 'burn'
  | 'freeze'
  | 'shock'
  | 'bleed'
  | 'confusion'
  | 'paralysis'
  | 'fear'
  | 'blind';

export interface StatusConfig {
  name: string;
  color: number;       // Phaser tint hex
  duration: number;    // ms
  tickRate?: number;   // ms between damage ticks
  tickDamage?: number;
  speedMult?: number;
  canAttack?: boolean;
  canMove?: boolean;
  reverseControls?: boolean;
  stunChance?: number;
  icon: string;
  particleColor: number;
}

export const STATUS_CONFIGS: Record<StatusType, StatusConfig> = {
  poison: {
    name: '毒',
    color: 0x44ff44,
    duration: 5000,
    tickRate: 800,
    tickDamage: 3,
    speedMult: 0.9,
    icon: '☠',
    particleColor: 0x44ee44,
  },
  burn: {
    name: '炎上',
    color: 0xff6600,
    duration: 3000,
    tickRate: 500,
    tickDamage: 5,
    speedMult: 0.85,
    icon: '🔥',
    particleColor: 0xff4400,
  },
  freeze: {
    name: '凍結',
    color: 0x88ddff,
    duration: 2500,
    speedMult: 0.3,
    icon: '❄',
    particleColor: 0xaaeeff,
  },
  shock: {
    name: '感電',
    color: 0xffff00,
    duration: 2000,
    stunChance: 0.4,
    speedMult: 0.7,
    icon: '⚡',
    particleColor: 0xffff44,
  },
  bleed: {
    name: '出血',
    color: 0xff2222,
    duration: 4000,
    tickRate: 600,
    tickDamage: 4,
    icon: '💉',
    particleColor: 0xcc0000,
  },
  confusion: {
    name: '混乱',
    color: 0xcc44ff,
    duration: 3500,
    reverseControls: true,
    speedMult: 0.8,
    icon: '❓',
    particleColor: 0xaa22ee,
  },
  paralysis: {
    name: '麻痺',
    color: 0xffcc44,
    duration: 2000,
    canMove: false,
    canAttack: false,
    icon: '⚡',
    particleColor: 0xeeaa00,
  },
  fear: {
    name: '恐怖',
    color: 0x9944bb,
    duration: 3000,
    speedMult: 1.4, // flees fast
    canAttack: false,
    icon: '👻',
    particleColor: 0x7722aa,
  },
  blind: {
    name: '暗闇',
    color: 0x222222,
    duration: 2500,
    icon: '🌑',
    particleColor: 0x333333,
  },
};

export interface ActiveStatus {
  type: StatusType;
  expiresAt: number;
  lastTick?: number;
  particles?: Phaser.GameObjects.Particles.ParticleEmitter;
  overlay?: Phaser.GameObjects.Rectangle;
}

export class StatusEffectManager {
  private statuses: Map<StatusType, ActiveStatus> = new Map();
  private scene: Phaser.Scene;
  private owner: Phaser.GameObjects.Sprite;
  private onDamage: (amount: number) => void;
  private onStun: () => void;

  constructor(
    scene: Phaser.Scene,
    owner: Phaser.GameObjects.Sprite,
    onDamage: (amount: number) => void,
    onStun: () => void
  ) {
    this.scene = scene;
    this.owner = owner;
    this.onDamage = onDamage;
    this.onStun = onStun;
  }

  apply(type: StatusType) {
    const cfg = STATUS_CONFIGS[type];
    const existing = this.statuses.get(type);

    // Refresh duration if already active
    const expiresAt = this.scene.time.now + cfg.duration;

    if (existing) {
      existing.expiresAt = expiresAt;
      return;
    }

    // Create visual particle emitter
    let particles: Phaser.GameObjects.Particles.ParticleEmitter | undefined;
    try {
      // Use a tiny 2×2 pixel texture from fxSheet or a simple circle
      particles = this.scene.add.particles(
        this.owner.x, this.owner.y, 'fx',
        {
          frame: '0_1',
          x: { min: -8, max: 8 },
          y: { min: -16, max: 0 },
          speed: { min: 10, max: 40 },
          lifespan: 600,
          quantity: 1,
          frequency: 120,
          tint: cfg.particleColor,
          alpha: { start: 0.8, end: 0 },
          scale: { start: 0.6, end: 0.2 },
          gravityY: -20,
        }
      );
    } catch { /* particles optional */ }

    this.statuses.set(type, { type, expiresAt, particles });
    this.applyVisualTint();
  }

  remove(type: StatusType) {
    const s = this.statuses.get(type);
    if (!s) return;
    s.particles?.destroy();
    s.overlay?.destroy();
    this.statuses.delete(type);
    this.applyVisualTint();
  }

  removeAll() {
    for (const [type] of this.statuses) this.remove(type);
  }

  has(type: StatusType): boolean {
    return this.statuses.has(type);
  }

  getAll(): StatusType[] {
    return Array.from(this.statuses.keys());
  }

  /** Returns combined speed multiplier */
  getSpeedMultiplier(): number {
    let mult = 1;
    for (const [type] of this.statuses) {
      const m = STATUS_CONFIGS[type].speedMult;
      if (m !== undefined) mult *= m;
    }
    return mult;
  }

  canMove(): boolean {
    for (const [type] of this.statuses) {
      if (STATUS_CONFIGS[type].canMove === false) return false;
    }
    return true;
  }

  canAttack(): boolean {
    for (const [type] of this.statuses) {
      if (STATUS_CONFIGS[type].canAttack === false) return false;
    }
    return true;
  }

  reversedControls(): boolean {
    return this.has('confusion');
  }

  isBlind(): boolean {
    return this.has('blind');
  }

  /** Call every frame */
  update(time: number) {
    for (const [type, status] of this.statuses) {
      // Expiry check
      if (time > status.expiresAt) {
        this.remove(type);
        continue;
      }

      const cfg = STATUS_CONFIGS[type];

      // Follow owner
      if (status.particles) {
        status.particles.setPosition(this.owner.x, this.owner.y);
      }

      // Stun check (shock)
      if (type === 'shock' && cfg.stunChance) {
        if (Math.random() < cfg.stunChance * 0.002) {
          this.onStun();
        }
      }

      // DOT ticks
      if (cfg.tickRate && cfg.tickDamage) {
        const lastTick = status.lastTick ?? status.expiresAt - cfg.duration;
        if (time - lastTick >= cfg.tickRate) {
          status.lastTick = time;
          this.onDamage(cfg.tickDamage);
          // Flash particle burst
          status.particles?.explode(4);
        }
      }
    }
  }

  /** Blend active status tints on owner sprite */
  private applyVisualTint() {
    if (this.statuses.size === 0) {
      this.owner.clearTint();
      return;
    }
    // Use highest-priority status for tint
    const priority: StatusType[] = ['paralysis','burn','freeze','shock','poison','bleed','confusion','fear','blind'];
    for (const p of priority) {
      if (this.statuses.has(p)) {
        this.owner.setTint(STATUS_CONFIGS[p].color);
        return;
      }
    }
  }

  /** Render status icons as text objects (call once, update positions) */
  createStatusBar(x: number, y: number): Phaser.GameObjects.Text[] {
    return [];
  }
}
