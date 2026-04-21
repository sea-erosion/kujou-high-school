/**
 * SpriteGenerator.ts
 * Generates all pixel-art sprite sheets programmatically using canvas.
 * Each sprite is 32x32 pixels. Sheets are laid out horizontally.
 */

type RGB = [number, number, number];

const C = {
  // Player palette
  SKIN:     [255, 220, 170] as RGB,
  SKIN_S:   [200, 160, 110] as RGB,
  HAIR:     [30,  20,  10]  as RGB,
  UNIFORM:  [40,  40,  80]  as RGB,
  UNIFORM_S:[20,  20,  50]  as RGB,
  SHIRT:    [240, 240, 240] as RGB,
  SHOES:    [20,  20,  20]  as RGB,
  UMBRELLA: [10,  10,  10]  as RGB,
  UMBRELLA_H:[60, 60,  80]  as RGB,
  BLOOD:    [200, 30,  30]  as RGB,
  // Enemy palette
  GANG_BLUE: [30,  60,  120] as RGB,
  GANG_RED:  [120, 30,  30]  as RGB,
  BOSS_DARK: [20,  20,  40]  as RGB,
  // FX
  YELLOW:   [255, 220, 0]   as RGB,
  ORANGE:   [255, 120, 0]   as RGB,
  RED:      [220, 40,  40]  as RGB,
  WHITE:    [255, 255, 255] as RGB,
  CYAN:     [100, 220, 255] as RGB,
  GREEN:    [60,  220, 60]  as RGB,
  PURPLE:   [180, 60,  220] as RGB,
  TRANS:    [0,   0,   0]   as RGB,  // transparent placeholder
};

function createCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function px(ctx: CanvasRenderingContext2D, x: number, y: number, color: RGB, a = 255) {
  if (color === C.TRANS) return;
  ctx.fillStyle = `rgba(${color[0]},${color[1]},${color[2]},${a/255})`;
  ctx.fillRect(x, y, 1, 1);
}

function rect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: RGB) {
  ctx.fillStyle = `rgb(${color[0]},${color[1]},${color[2]})`;
  ctx.fillRect(x, y, w, h);
}

// ─────────────────────────────────────────────
// PLAYER SPRITE BUILDER
// ─────────────────────────────────────────────

function drawPlayerBase(ctx: CanvasRenderingContext2D, ox: number, oy: number, legPhase: number = 0) {
  // Head
  rect(ctx, ox+11, oy+2,  10, 10, C.SKIN);
  rect(ctx, ox+11, oy+2,  10, 3,  C.HAIR);
  px(ctx, ox+13, oy+5, C.HAIR);
  // Eyes
  px(ctx, ox+13, oy+6, C.SHOES);
  px(ctx, ox+18, oy+6, C.SHOES);
  // Mouth
  px(ctx, ox+15, oy+8, C.SKIN_S);
  // Neck
  rect(ctx, ox+14, oy+12, 4, 2, C.SKIN);
  // Body (uniform jacket)
  rect(ctx, ox+9,  oy+14, 14, 10, C.UNIFORM);
  rect(ctx, ox+14, oy+14, 4,  10, C.SHIRT);   // shirt/tie area
  px(ctx, ox+15, oy+16, C.BLOOD);             // tie
  px(ctx, ox+15, oy+17, C.BLOOD);
  // Collar
  rect(ctx, ox+10, oy+14, 3, 2, C.UNIFORM_S);
  rect(ctx, ox+19, oy+14, 3, 2, C.UNIFORM_S);
  // Arms (pose A)
  rect(ctx, ox+5,  oy+14, 4, 8, C.UNIFORM);   // left arm
  rect(ctx, ox+23, oy+14, 4, 8, C.UNIFORM);   // right arm
  rect(ctx, ox+5,  oy+22, 4, 3, C.SKIN);      // left hand
  rect(ctx, ox+23, oy+22, 4, 3, C.SKIN);      // right hand
  // Legs
  if (legPhase === 0) {
    rect(ctx, ox+10, oy+24, 5, 6, C.UNIFORM);
    rect(ctx, ox+17, oy+24, 5, 6, C.UNIFORM);
    rect(ctx, ox+9,  oy+30, 6, 2, C.SHOES);
    rect(ctx, ox+17, oy+30, 6, 2, C.SHOES);
  } else if (legPhase === 1) {
    rect(ctx, ox+8,  oy+24, 5, 6, C.UNIFORM);
    rect(ctx, ox+18, oy+24, 5, 6, C.UNIFORM);
    rect(ctx, ox+7,  oy+30, 6, 2, C.SHOES);
    rect(ctx, ox+18, oy+30, 6, 2, C.SHOES);
  } else if (legPhase === 2) {
    rect(ctx, ox+10, oy+24, 5, 5, C.UNIFORM);
    rect(ctx, ox+17, oy+24, 5, 5, C.UNIFORM);
    rect(ctx, ox+9,  oy+29, 6, 2, C.SHOES);
    rect(ctx, ox+17, oy+29, 6, 2, C.SHOES);
  } else if (legPhase === 3) {
    rect(ctx, ox+11, oy+24, 5, 6, C.UNIFORM);
    rect(ctx, ox+16, oy+24, 5, 6, C.UNIFORM);
    rect(ctx, ox+11, oy+30, 6, 2, C.SHOES);
    rect(ctx, ox+16, oy+30, 6, 2, C.SHOES);
  }
}

function drawUmbrellaTrail(ctx: CanvasRenderingContext2D, ox: number, oy: number, frame: number) {
  // Trailing umbrella behind player (closed)
  const trailX = ox - 6 + frame;
  rect(ctx, trailX,    oy+16, 1, 14, C.UMBRELLA_H); // shaft
  rect(ctx, trailX-2,  oy+16, 5, 2,  C.UMBRELLA);   // canopy top
  px(ctx, trailX,   oy+30, C.UMBRELLA_H); // tip
}

function drawUmbrellaClosed(ctx: CanvasRenderingContext2D, ox: number, oy: number, angle: number) {
  // Closed umbrella as weapon
  if (angle === 0) { // forward
    rect(ctx, ox+23, oy+20, 12, 2, C.UMBRELLA);
    rect(ctx, ox+34, oy+18, 2,  6, C.UMBRELLA);   // tip cap
    px(ctx, ox+35, oy+21, C.UMBRELLA_H);
  } else if (angle === 1) { // up
    rect(ctx, ox+16, oy+8,  2, 12, C.UMBRELLA);
    rect(ctx, ox+14, oy+6,  6, 2,  C.UMBRELLA);
  } else { // down
    rect(ctx, ox+16, oy+24, 2, 12, C.UMBRELLA);
    rect(ctx, ox+14, oy+36, 6, 2,  C.UMBRELLA);
  }
}

function drawUmbrellaOpen(ctx: CanvasRenderingContext2D, ox: number, oy: number) {
  // Open umbrella as shield
  for (let i = 0; i < 12; i++) {
    const c = i % 2 === 0 ? C.UMBRELLA : C.UMBRELLA_H;
    const spread = Math.floor(i * 2.5);
    rect(ctx, ox+4+spread, oy+8, 2, 3+i/2, c);
  }
  rect(ctx, ox+6, oy+6, 20, 4, C.UMBRELLA);
  rect(ctx, ox+14, oy+10, 4, 18, C.UMBRELLA_H); // shaft
}

// ─────────────────────────────────────────────
// GENERATE PLAYER SPRITESHEET
// Frame layout (32x32 each):
// Row 0: idle x3
// Row 1: run x4
// Row 2: jump x5
// Row 3: attack_fwd x4, attack_up x4, attack_dn x4
// Row 4: guard x3, dash x3, roll x4
// Row 5: hurt x2, death x3, finisher x5
// ─────────────────────────────────────────────

export function generatePlayerSheet(): HTMLCanvasElement {
  const FW = 32, FH = 48;
  const cols = 14;
  const rows = 6;
  const c = createCanvas(FW * cols, FH * rows);
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  // --- ROW 0: IDLE (3 frames) ---
  [0,1,2].forEach((f, i) => {
    const ox = i * FW, oy = 0;
    drawPlayerBase(ctx, ox, oy, f % 2);
    drawUmbrellaTrail(ctx, ox, oy, f);
  });

  // --- ROW 1: RUN (4 frames) ---
  [0,1,2,3].forEach((f, i) => {
    const ox = i * FW, oy = FH;
    drawPlayerBase(ctx, ox, oy, f);
    drawUmbrellaTrail(ctx, ox, oy, f*2);
  });

  // --- ROW 2: JUMP (5 frames) ---
  [0,1,2,3,4].forEach((f, i) => {
    const ox = i * FW, oy = FH*2;
    // jump pose: legs tucked
    rect(ctx, ox+11, oy+2,  10, 10, C.SKIN);
    rect(ctx, ox+11, oy+2,  10, 3,  C.HAIR);
    px(ctx, ox+13, oy+6, C.SHOES);
    px(ctx, ox+18, oy+6, C.SHOES);
    rect(ctx, ox+14, oy+12, 4, 2, C.SKIN);
    rect(ctx, ox+9,  oy+14, 14, 10, C.UNIFORM);
    rect(ctx, ox+14, oy+14, 4, 10, C.SHIRT);
    // arms up
    rect(ctx, ox+6,  oy+12, 4, 6, C.UNIFORM);
    rect(ctx, ox+22, oy+12, 4, 6, C.UNIFORM);
    rect(ctx, ox+6,  oy+18, 4, 3, C.SKIN);
    rect(ctx, ox+22, oy+18, 4, 3, C.SKIN);
    // legs tucked based on phase
    const tuck = f < 2 ? 0 : f < 4 ? 4 : 2;
    rect(ctx, ox+9,  oy+24+tuck, 5, 5, C.UNIFORM);
    rect(ctx, ox+18, oy+24+tuck, 5, 5, C.UNIFORM);
    rect(ctx, ox+8,  oy+28+tuck, 6, 2, C.SHOES);
    rect(ctx, ox+18, oy+28+tuck, 6, 2, C.SHOES);
    drawUmbrellaTrail(ctx, ox, oy, f);
  });

  // --- ROW 3: ATTACKS ---
  // attack_fwd (4 frames: windup, swing1, impact, recovery)
  const attackRow = FH * 3;
  // Windup
  drawPlayerBase(ctx, 0, attackRow, 0);
  rect(ctx, 2, attackRow+16, 4, 8, C.UNIFORM); // arm back
  rect(ctx, 2, attackRow+24, 4, 3, C.SKIN);
  rect(ctx, -2, attackRow+20, 14, 2, C.UMBRELLA); // umbrella pulled back

  // Swing
  drawPlayerBase(ctx, FW, attackRow, 0);
  drawUmbrellaClosed(ctx, FW-4, attackRow, 0);

  // Impact
  drawPlayerBase(ctx, FW*2, attackRow, 0);
  drawUmbrellaClosed(ctx, FW*2-2, attackRow, 0);
  // impact flash
  rect(ctx, FW*2+28, attackRow+17, 6, 6, C.YELLOW);
  px(ctx, FW*2+31, attackRow+19, C.WHITE);

  // Recovery
  drawPlayerBase(ctx, FW*3, attackRow, 0);
  rect(ctx, FW*3+23, attackRow+22, 10, 2, C.UMBRELLA);

  // attack_up (4 frames) cols 4-7
  [0,1,2,3].forEach((f, i) => {
    const ox = (4+i)*FW, oy = attackRow;
    drawPlayerBase(ctx, ox, oy, 0);
    if (f < 2) {
      drawUmbrellaClosed(ctx, ox, oy, 1);
    } else {
      rect(ctx, ox+14, oy+2, 4, 14, C.UMBRELLA);
      if (f === 2) {
        rect(ctx, ox+10, oy+0, 12, 4, C.YELLOW);
      }
    }
  });

  // attack_down (4 frames) cols 8-11
  [0,1,2,3].forEach((f, i) => {
    const ox = (8+i)*FW, oy = attackRow;
    drawPlayerBase(ctx, ox, oy, 0);
    if (f < 2) {
      drawUmbrellaClosed(ctx, ox, oy, 2);
    } else {
      rect(ctx, ox+14, oy+24, 4, 14, C.UMBRELLA);
      if (f === 2) {
        rect(ctx, ox+10, oy+36, 12, 4, C.YELLOW);
      }
    }
  });

  // --- ROW 4: GUARD / DASH / ROLL ---
  const miscRow = FH * 4;

  // Guard frames (0-2): open umbrella shield
  [0,1,2].forEach((f, i) => {
    const ox = i * FW, oy = miscRow;
    drawPlayerBase(ctx, ox, oy, 0);
    drawUmbrellaOpen(ctx, ox-4, oy);
  });

  // Dash frames (3-5)
  [0,1,2].forEach((f, i) => {
    const ox = (3+i) * FW, oy = miscRow;
    // Leaning forward run
    rect(ctx, ox+13, oy+3, 8, 9, C.SKIN);
    rect(ctx, ox+13, oy+3, 8, 3, C.HAIR);
    px(ctx, ox+15, oy+6, C.SHOES);
    px(ctx, ox+19, oy+6, C.SHOES);
    rect(ctx, ox+14, oy+12, 4, 2, C.SKIN);
    rect(ctx, ox+10, oy+14, 14, 9, C.UNIFORM);
    rect(ctx, ox+15, oy+14, 4, 9, C.SHIRT);
    // arms trailing
    rect(ctx, ox+3,  oy+12, 4, 7, C.UNIFORM);
    rect(ctx, ox+24, oy+14, 4, 7, C.UNIFORM);
    rect(ctx, ox+3,  oy+19, 4, 3, C.SKIN);
    rect(ctx, ox+24, oy+21, 4, 3, C.SKIN);
    // legs running fast
    const lp = f * 2;
    rect(ctx, ox+11+lp, oy+23, 5, 6, C.UNIFORM);
    rect(ctx, ox+17-lp, oy+23, 5, 6, C.UNIFORM);
    rect(ctx, ox+10+lp, oy+29, 6, 2, C.SHOES);
    rect(ctx, ox+16-lp, oy+29, 6, 2, C.SHOES);
    // speed lines
    for (let s = 0; s < 3; s++) {
      rect(ctx, ox-4, oy+14+s*5, 8, 1, C.CYAN);
    }
    drawUmbrellaTrail(ctx, ox, oy, f*3);
  });

  // Roll frames (6-9)
  [0,1,2,3].forEach((f, i) => {
    const ox = (6+i) * FW, oy = miscRow;
    const rollY = oy + 8 + (f === 1 || f === 2 ? 4 : 0);
    // curled body
    rect(ctx, ox+8,  rollY+6, 16, 12, C.UNIFORM);
    rect(ctx, ox+12, rollY+2, 8,  8,  C.SKIN);
    rect(ctx, ox+12, rollY+2, 8,  3,  C.HAIR);
    rect(ctx, ox+6,  rollY+12, 8, 6,  C.SHOES);
    rect(ctx, ox+18, rollY+12, 8, 6,  C.SHOES);
    drawUmbrellaTrail(ctx, ox, oy, f*2);
  });

  // --- ROW 5: HURT / DEATH / FINISHER ---
  const specialRow = FH * 5;

  // Hurt (0-1)
  [0,1].forEach((f, i) => {
    const ox = i * FW, oy = specialRow;
    drawPlayerBase(ctx, ox, oy, 0);
    // hurt flash / knockback tint
    ctx.fillStyle = `rgba(255,80,80,0.4)`;
    ctx.fillRect(ox+9, oy+2, 16, 30);
    // flying stars
    for (let s = 0; s < 3; s++) {
      px(ctx, ox+10+s*4, oy+1, C.YELLOW);
    }
  });

  // Death (2-4)
  [0,1,2].forEach((f, i) => {
    const ox = (2+i) * FW, oy = specialRow;
    const fallY = oy + f * 4;
    if (f < 2) {
      rect(ctx, ox+9,  fallY+2,  14, 10, C.SKIN);
      rect(ctx, ox+9,  fallY+2,  14, 3,  C.HAIR);
      rect(ctx, ox+7,  fallY+12, 18, 10, C.UNIFORM);
      rect(ctx, ox+4,  fallY+22, 24, 6,  C.UNIFORM);
      rect(ctx, ox+2,  fallY+28, 10, 2,  C.SHOES);
      rect(ctx, ox+16, fallY+28, 10, 2,  C.SHOES);
    } else {
      // flat on ground
      rect(ctx, ox+2,  oy+36, 28, 4, C.UNIFORM);
      rect(ctx, ox+6,  oy+32, 8,  6, C.SKIN);
      rect(ctx, ox+6,  oy+32, 8,  3, C.HAIR);
      rect(ctx, ox+0,  oy+36, 6,  2, C.SHOES);
      rect(ctx, ox+26, oy+36, 6,  2, C.SHOES);
    }
  });

  // Finisher (5-9)
  [0,1,2,3,4].forEach((f, i) => {
    const ox = (5+i) * FW, oy = specialRow;
    drawPlayerBase(ctx, ox, oy, 0);
    // Big dramatic swing arc
    if (f === 0) {
      rect(ctx, ox-4, oy+16, 6, 2, C.UMBRELLA);
    } else if (f === 1) {
      rect(ctx, ox+23, oy+8, 12, 2, C.UMBRELLA);
    } else if (f === 2) {
      // full extension
      rect(ctx, ox+23, oy+12, 14, 2, C.UMBRELLA);
      rect(ctx, ox+35, oy+8,  4, 10, C.YELLOW);
      rect(ctx, ox+36, oy+10, 2,  6, C.WHITE);
    } else if (f === 3) {
      rect(ctx, ox+23, oy+18, 12, 2, C.UMBRELLA);
    } else {
      drawUmbrellaTrail(ctx, ox, oy, 2);
    }
    if (f === 2) {
      // shockwave ring
      ctx.strokeStyle = `rgba(255,220,0,0.8)`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(ox+36, oy+14, 8, 0, Math.PI * 2);
      ctx.stroke();
    }
  });

  return c;
}

// ─────────────────────────────────────────────
// ENEMY SPRITESHEET (Thug + Gang Boss)
// ─────────────────────────────────────────────

export function generateEnemySheet(): HTMLCanvasElement {
  const FW = 32, FH = 48;
  const c = createCanvas(FW * 10, FH * 4);
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  function drawThug(ox: number, oy: number, color: RGB, legPhase: number, alertLevel: number) {
    // Head
    rect(ctx, ox+11, oy+2, 10, 10, C.SKIN);
    rect(ctx, ox+11, oy+2, 10, 2,  color); // headband
    px(ctx, ox+13, oy+6, alertLevel > 0 ? C.RED : C.SHOES);
    px(ctx, ox+18, oy+6, alertLevel > 0 ? C.RED : C.SHOES);
    if (alertLevel > 1) {
      // angry brows
      rect(ctx, ox+12, oy+5, 3, 1, C.HAIR);
      rect(ctx, ox+17, oy+5, 3, 1, C.HAIR);
    }
    rect(ctx, ox+14, oy+12, 4, 2, C.SKIN);
    // Body
    rect(ctx, ox+9, oy+14, 14, 10, color);
    // Arms
    rect(ctx, ox+5, oy+14, 4, 8, color);
    rect(ctx, ox+23, oy+14, 4, 8, color);
    rect(ctx, ox+5, oy+22, 4, 3, C.SKIN);
    rect(ctx, ox+23, oy+22, 4, 3, C.SKIN);
    // Legs
    rect(ctx, ox+10+legPhase, oy+24, 5, 6, C.SHOES);
    rect(ctx, ox+17-legPhase, oy+24, 5, 6, C.SHOES);
    rect(ctx, ox+9+legPhase,  oy+30, 6, 2, C.HAIR);
    rect(ctx, ox+16-legPhase, oy+30, 6, 2, C.HAIR);
  }

  function drawBoss(ox: number, oy: number, legPhase: number) {
    // Larger, heavier build
    rect(ctx, ox+9,  oy+2,  14, 12, C.SKIN);
    rect(ctx, ox+9,  oy+2,  14, 3,  C.BOSS_DARK);
    px(ctx, ox+12, oy+7, C.RED);
    px(ctx, ox+19, oy+7, C.RED);
    rect(ctx, ox+12, oy+6, 3, 1, C.HAIR); // scar brow
    rect(ctx, ox+13, oy+14, 6, 2, C.SKIN);
    rect(ctx, ox+7,  oy+16, 18, 12, C.BOSS_DARK);
    rect(ctx, ox+14, oy+16, 4,  12, C.GANG_RED);
    // wide arms
    rect(ctx, ox+2,  oy+16, 5, 10, C.BOSS_DARK);
    rect(ctx, ox+25, oy+16, 5, 10, C.BOSS_DARK);
    rect(ctx, ox+2,  oy+26, 5, 4,  C.SKIN);
    rect(ctx, ox+25, oy+26, 5, 4,  C.SKIN);
    // chain weapon
    rect(ctx, ox+25, oy+18, 6, 1, C.YELLOW);
    rect(ctx, ox+30, oy+14, 2, 8, C.YELLOW);
    // legs
    rect(ctx, ox+8+legPhase, oy+28, 6, 8, C.BOSS_DARK);
    rect(ctx, ox+18-legPhase,oy+28, 6, 8, C.BOSS_DARK);
    rect(ctx, ox+7+legPhase, oy+36, 8, 2, C.HAIR);
    rect(ctx, ox+17-legPhase,oy+36, 8, 2, C.HAIR);
  }

  // THUG IDLE (row 0, frames 0-2)
  [0,1,2].forEach((f,i) => drawThug(i*FW, 0, C.GANG_BLUE, f%2, 1));
  // THUG RUN (row 0, frames 3-6)
  [0,1,2,3].forEach((f,i) => drawThug((3+i)*FW, 0, C.GANG_BLUE, f, 2));
  // THUG ATTACK (row 0, frames 7-9)
  [0,1,2].forEach((f,i) => {
    const ox = (7+i)*FW, oy = 0;
    drawThug(ox, oy, C.GANG_BLUE, 0, 2);
    // punch arm
    rect(ctx, ox+23, oy+16, 10+f*3, 4, C.GANG_BLUE);
    rect(ctx, ox+23+10+f*3, oy+14, 5, 8, C.SKIN);
    if (f === 2) rect(ctx, ox+38, oy+14, 4, 8, C.YELLOW);
  });

  // THUG HURT/DEATH (row 1, 0-3)
  [0,1,2,3].forEach((f,i) => {
    const ox = i*FW, oy = FH;
    drawThug(ox, oy, C.GANG_BLUE, 0, 2);
    ctx.fillStyle = `rgba(255,80,80,${0.3+f*0.1})`;
    ctx.fillRect(ox+7, oy+2, 18, 32);
    if (f >= 2) {
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(ox+7, oy+32, 18, 6);
    }
  });

  // RED GANG THUG (row 1, frames 4-9)
  [0,1,2,3,4,5].forEach((f,i) => {
    const oy = FH;
    if (f < 3) drawThug((4+i)*FW, oy, C.GANG_RED, f%2, 1);
    else drawThug((4+i)*FW, oy, C.GANG_RED, f-3, 2);
  });

  // BOSS IDLE (row 2, frames 0-2)
  [0,1,2].forEach((f,i) => drawBoss(i*FW, FH*2, f%2));
  // BOSS RUN (row 2, frames 3-6)
  [0,1,2,3].forEach((f,i) => drawBoss((3+i)*FW, FH*2, f));
  // BOSS ATTACK (row 2, frames 7-9)
  [0,1,2].forEach((f,i) => {
    const ox = (7+i)*FW, oy = FH*2;
    drawBoss(ox, oy, 0);
    // chain swing
    const chainLen = 8 + f * 6;
    for (let c2 = 0; c2 < chainLen; c2 += 3) {
      rect(ctx, ox+30+c2, oy+14+Math.sin(c2*0.5+f)*4, 2, 2, C.YELLOW);
    }
    if (f === 2) {
      rect(ctx, ox+30+chainLen, oy+12, 6, 8, C.RED);
    }
  });

  // BOSS HURT/DEATH (row 3)
  [0,1,2,3].forEach((f,i) => {
    const ox = i*FW, oy = FH*3;
    drawBoss(ox, oy, 0);
    ctx.fillStyle = `rgba(255,80,80,${0.3+f*0.15})`;
    ctx.fillRect(ox+5, oy+2, 22, 38);
    for (let s = 0; s < 4; s++) {
      px(ctx, ox+10+s*3, oy+1, C.YELLOW);
    }
  });

  return c;
}

// ─────────────────────────────────────────────
// TILESET (school environment)
// ─────────────────────────────────────────────

export function generateTileset(): HTMLCanvasElement {
  const TS = 16;
  // 16 tiles wide
  const c = createCanvas(TS * 16, TS * 8);
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  const FLOOR_A:  RGB = [60,  55,  80];
  const FLOOR_B:  RGB = [50,  45,  70];
  const WALL_A:   RGB = [100, 95,  130];
  const WALL_B:   RGB = [80,  75,  110];
  const WALL_TOP: RGB = [120, 115, 150];
  const WINDOW_A: RGB = [100, 180, 220];
  const WINDOW_B: RGB = [60,  140, 180];
  const DESK:     RGB = [160, 120, 60];
  const DESK_S:   RGB = [120, 80,  30];
  const LOCKER:   RGB = [80,  100, 140];
  const LOCKER_S: RGB = [60,  75,  110];
  const BLACKBOARD: RGB = [30, 60, 50];
  const CHALK:    RGB = [220, 220, 200];
  const PLATFORM: RGB = [70,  65,  95];
  const PLAT_TOP: RGB = [90,  85,  115];
  const SKY:      RGB = [15,  15,  30];
  const METAL:    RGB = [80,  90,  100];
  const METAL_S:  RGB = [60,  70,  80];
  const GRASS:    RGB = [40,  80,  40];

  function tile(tx: number, ty: number, draw: (ox:number,oy:number)=>void) {
    draw(tx*TS, ty*TS);
  }

  // 0: Empty/sky
  tile(0,0,(ox,oy)=>{ rect(ctx,ox,oy,TS,TS,SKY); });
  // 1: Floor
  tile(1,0,(ox,oy)=>{
    rect(ctx,ox,oy,TS,TS,FLOOR_A);
    rect(ctx,ox,oy,TS,1,WALL_TOP);
    rect(ctx,ox,oy+2,TS,1,FLOOR_B);
    for(let x=0;x<TS;x+=4) px(ctx,ox+x,oy+8,FLOOR_B);
  });
  // 2: Wall
  tile(2,0,(ox,oy)=>{
    rect(ctx,ox,oy,TS,TS,WALL_A);
    for(let y=0;y<TS;y+=4) rect(ctx,ox,oy+y,TS,2,WALL_B);
  });
  // 3: Wall top
  tile(3,0,(ox,oy)=>{
    rect(ctx,ox,oy,TS,TS,WALL_A);
    rect(ctx,ox,oy,TS,3,WALL_TOP);
  });
  // 4: Window
  tile(4,0,(ox,oy)=>{
    rect(ctx,ox,oy,TS,TS,WALL_A);
    rect(ctx,ox+2,oy+2,12,12,WINDOW_A);
    rect(ctx,ox+2,oy+2,12,1,WINDOW_B);
    rect(ctx,ox+2,oy+2,1,12,WINDOW_B);
    px(ctx,ox+TS/2,oy+2,WINDOW_B); // cross
    for(let yy=0;yy<12;yy+=2) px(ctx,ox+TS/2,oy+2+yy,WINDOW_B);
  });
  // 5: Platform top
  tile(5,0,(ox,oy)=>{
    rect(ctx,ox,oy,TS,TS,SKY);
    rect(ctx,ox,oy,TS,6,PLATFORM);
    rect(ctx,ox,oy,TS,2,PLAT_TOP);
  });
  // 6: Desk
  tile(6,0,(ox,oy)=>{
    rect(ctx,ox,oy,TS,TS,SKY);
    rect(ctx,ox+1,oy+4,14,8,DESK);
    rect(ctx,ox+1,oy+4,14,1,DESK_S);
    rect(ctx,ox+1,oy+12,2,4,DESK_S);
    rect(ctx,ox+13,oy+12,2,4,DESK_S);
  });
  // 7: Locker
  tile(7,0,(ox,oy)=>{
    rect(ctx,ox,oy,TS,TS,LOCKER);
    rect(ctx,ox+1,oy,14,TS,LOCKER);
    rect(ctx,ox+1,oy,14,1,LOCKER_S);
    rect(ctx,ox+TS/2,oy,1,TS,LOCKER_S);
    px(ctx,ox+4,oy+8,METAL);
    px(ctx,ox+12,oy+8,METAL);
  });
  // 8: Blackboard
  tile(8,0,(ox,oy)=>{
    rect(ctx,ox,oy,TS,TS,BLACKBOARD);
    rect(ctx,ox,oy,TS,1,DESK_S);
    rect(ctx,ox,oy+TS-1,TS,1,DESK_S);
    // chalk writing hint
    for(let i=0;i<3;i++) rect(ctx,ox+2+i*5,oy+4,4,1,CHALK);
    rect(ctx,ox+2,oy+8,6,1,CHALK);
  });
  // 9: Stairs
  tile(9,0,(ox,oy)=>{
    for(let s=0;s<4;s++){
      rect(ctx,ox+s*4,oy+s*4,TS-s*4,4,FLOOR_A);
      rect(ctx,ox+s*4,oy+s*4,TS-s*4,1,PLAT_TOP);
    }
  });
  // 10: Metal railing
  tile(10,0,(ox,oy)=>{
    rect(ctx,ox,oy,TS,TS,SKY);
    rect(ctx,ox,oy+4,TS,2,METAL);
    for(let x=1;x<TS;x+=3) rect(ctx,ox+x,oy,2,TS,METAL_S);
  });
  // 11: Grass / exterior
  tile(11,0,(ox,oy)=>{
    rect(ctx,ox,oy,TS,TS,FLOOR_A);
    rect(ctx,ox,oy,TS,3,GRASS);
  });
  // 12: Ceiling
  tile(12,0,(ox,oy)=>{
    rect(ctx,ox,oy,TS,TS,WALL_A);
    rect(ctx,ox,oy+TS-3,TS,3,FLOOR_B);
    // light fixture hint
    rect(ctx,ox+4,oy+TS-5,8,2,C.YELLOW);
    px(ctx,ox+7,oy+TS-4,C.WHITE);
  });

  return c;
}

// ─────────────────────────────────────────────
// FX SPRITESHEETS
// ─────────────────────────────────────────────

export function generateFXSheet(): HTMLCanvasElement {
  const FW = 24, FH = 24;
  const c = createCanvas(FW * 10, FH * 6);
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  function circle(ox:number, oy:number, cx:number, cy:number, r:number, color:RGB, a=255) {
    for(let y=-r;y<=r;y++) for(let x=-r;x<=r;x++) {
      if(x*x+y*y<=r*r) px(ctx, ox+cx+x, oy+cy+y, color, a);
    }
  }

  // Row 0: Hit spark (4 frames)
  [4,8,12,6].forEach((r,i) => {
    const ox=i*FW, oy=0, cx=FW/2, cy=FH/2;
    circle(ox,oy,cx,cy,r,C.YELLOW,255);
    circle(ox,oy,cx,cy,r-2,C.WHITE,200);
    // spikes
    for(let d=0;d<8;d++){
      const a=d*Math.PI/4, len=r+4;
      const ex=Math.round(cx+Math.cos(a)*len), ey=Math.round(cy+Math.sin(a)*len);
      px(ctx,ox+ex,oy+ey,C.YELLOW);
    }
  });

  // Row 0 cont: Guard block (3 frames)
  [6,10,8].forEach((r,i)=>{
    const ox=(4+i)*FW, oy=0, cx=FW/2, cy=FH/2;
    circle(ox,oy,cx,cy,r,C.CYAN,180);
    circle(ox,oy,cx,cy,r-3,C.WHITE,100);
    ctx.strokeStyle=`rgba(100,220,255,0.8)`;
    ctx.lineWidth=1;
    ctx.beginPath(); ctx.arc(ox+cx,oy+cy,r+1,0,Math.PI*2); ctx.stroke();
  });

  // Row 0 cont: Finish spark (3 frames big)
  [8,14,10].forEach((r,i)=>{
    const ox=(7+i)*FW, oy=0, cx=FW/2, cy=FH/2;
    circle(ox,oy,cx,cy,r,C.ORANGE,255);
    circle(ox,oy,cx,cy,r-3,C.YELLOW,220);
    circle(ox,oy,cx,cy,r-6,C.WHITE,180);
    for(let d=0;d<12;d++){
      const a=d*Math.PI/6, len=r+6;
      const ex=Math.round(cx+Math.cos(a)*len), ey=Math.round(cy+Math.sin(a)*len);
      rect(ctx,ox+ex-1,oy+ey-1,2,2,C.YELLOW);
    }
  });

  // Row 1: Status FX (poison, burn, freeze, shock, bleed, confusion, paralysis, fear, blind)
  const statusColors: RGB[] = [C.GREEN,C.ORANGE,C.CYAN,C.YELLOW,C.RED,C.PURPLE,C.YELLOW,C.PURPLE,C.HAIR];
  statusColors.forEach((col,i)=>{
    const ox=i*FW, oy=FH;
    // pulsing aura frame
    circle(ox,oy,FW/2,FH/2,9,col,120);
    circle(ox,oy,FW/2,FH/2,5,col,200);
    // icon hint
    rect(ctx,ox+FW/2-1,oy+FH/2-4,2,8,col);
    rect(ctx,ox+FW/2-4,oy+FH/2-1,8,2,col);
  });

  // Row 2-3: Blood / dust particles (procedural)
  for(let f=0;f<10;f++){
    const ox=f*FW, oy=FH*2;
    for(let p=0;p<8;p++){
      const px2=Math.round(FW/2+(Math.cos(p*Math.PI/4)*(4+f*0.5)));
      const py2=Math.round(FH/2+(Math.sin(p*Math.PI/4)*(4+f*0.5)));
      rect(ctx,ox+px2-1,oy+py2-1,2,2,C.BLOOD);
    }
  }

  return c;
}

// ─────────────────────────────────────────────
// BACKGROUND LAYERS
// ─────────────────────────────────────────────

export function generateBackground(layer: number): HTMLCanvasElement {
  const W = 800, H = 400;
  const c = createCanvas(W, H);
  const ctx = c.getContext('2d')!;

  if (layer === 0) {
    // Sky / far bg
    const grad = ctx.createLinearGradient(0,0,0,H);
    grad.addColorStop(0, '#0a0a1a');
    grad.addColorStop(0.6, '#1a1030');
    grad.addColorStop(1, '#2a1040');
    ctx.fillStyle = grad;
    ctx.fillRect(0,0,W,H);
    // Stars
    for(let i=0;i<120;i++){
      const x=Math.floor(Math.random()*W), y=Math.floor(Math.random()*(H*0.7));
      const a=0.4+Math.random()*0.6;
      ctx.fillStyle=`rgba(255,255,255,${a})`;
      ctx.fillRect(x,y,1,1);
      if(Math.random()>0.8) ctx.fillRect(x+1,y,1,1);
    }
    // Moon
    ctx.fillStyle='rgba(220,220,180,0.9)';
    ctx.beginPath(); ctx.arc(680,60,28,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='rgba(10,10,26,0.3)';
    ctx.beginPath(); ctx.arc(690,54,24,0,Math.PI*2); ctx.fill();
  } else if (layer === 1) {
    // School building silhouette (far)
    ctx.clearRect(0,0,W,H);
    ctx.fillStyle='rgba(20,15,35,0.85)';
    // building body
    ctx.fillRect(50,100,700,300);
    // windows
    for(let floor=0;floor<4;floor++){
      for(let win=0;win<14;win++){
        const wx=70+win*50, wy=120+floor*55;
        const lit=Math.random()>0.5;
        ctx.fillStyle=lit?'rgba(255,220,120,0.7)':'rgba(30,30,60,0.9)';
        ctx.fillRect(wx,wy,18,24);
        if(lit){
          ctx.fillStyle='rgba(255,220,120,0.2)';
          ctx.fillRect(wx-2,wy-2,22,28);
        }
      }
    }
    // roof
    ctx.fillStyle='rgba(15,10,28,0.9)';
    ctx.fillRect(30,90,740,20);
    // rooftop fence
    for(let f=0;f<15;f++){
      ctx.fillStyle='rgba(40,35,60,0.9)';
      ctx.fillRect(40+f*48,70,4,22);
      ctx.fillRect(40+f*48,68,6,4);
    }
    // water tower
    ctx.fillStyle='rgba(50,45,70,0.9)';
    ctx.fillRect(620,50,50,50);
    ctx.beginPath();
    ctx.arc(645,50,25,Math.PI,0); ctx.fill();
    ctx.fillRect(630,68,6,22); ctx.fillRect(654,68,6,22);
  } else {
    // Foreground parallax: cherry blossom branches, street lamps
    ctx.clearRect(0,0,W,H);
    // Lamps
    [100,400,700].forEach(lx=>{
      ctx.fillStyle='rgba(60,55,80,0.9)';
      ctx.fillRect(lx-2,180,4,220);
      ctx.fillStyle='rgba(255,220,100,0.8)';
      ctx.fillRect(lx-12,170,24,14);
      // glow
      const grd=ctx.createRadialGradient(lx,177,2,lx,177,40);
      grd.addColorStop(0,'rgba(255,220,100,0.3)');
      grd.addColorStop(1,'rgba(255,220,100,0)');
      ctx.fillStyle=grd; ctx.fillRect(lx-40,140,80,80);
    });
    // Cherry blossoms
    ctx.strokeStyle='rgba(80,50,30,0.7)'; ctx.lineWidth=3;
    [0,200,600,750].forEach(bx=>{
      ctx.beginPath(); ctx.moveTo(bx,0); ctx.bezierCurveTo(bx+40,80,bx+60,120,bx+80,200); ctx.stroke();
      ctx.lineWidth=1;
      for(let b=0;b<8;b++){
        const t=b/8, tx=bx+40*t+Math.sin(t*5)*20, ty=80+t*120;
        for(let p=0;p<4;p++){
          ctx.fillStyle='rgba(255,180,200,0.6)';
          ctx.beginPath(); ctx.arc(tx+Math.cos(p*Math.PI/2)*5,ty+Math.sin(p*Math.PI/2)*5,3,0,Math.PI*2); ctx.fill();
        }
      }
      ctx.lineWidth=3;
    });
  }
  return c;
}

// ─────────────────────────────────────────────
// LOAD ALL ASSETS → Phaser texture keys
// ─────────────────────────────────────────────

export function loadGeneratedAssets(scene: Phaser.Scene) {
  const playerSheet = generatePlayerSheet();
  scene.textures.addCanvas('player', playerSheet);

  const enemySheet = generateEnemySheet();
  scene.textures.addCanvas('enemy', enemySheet);

  const tileset = generateTileset();
  scene.textures.addCanvas('tiles', tileset);

  const fxSheet = generateFXSheet();
  scene.textures.addCanvas('fx', fxSheet);

  const bg0 = generateBackground(0);
  scene.textures.addCanvas('bg0', bg0);
  const bg1 = generateBackground(1);
  scene.textures.addCanvas('bg1', bg1);
  const bg2 = generateBackground(2);
  scene.textures.addCanvas('bg2', bg2);
}
