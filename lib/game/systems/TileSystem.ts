/**
 * TileSystem.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * 完全タイルマップエンジン
 *
 * タイル種別:
 *   0  = 空（スカイ）
 *   1  = 床（ソリッド上面あり）
 *   2  = 壁（全面ソリッド）
 *   3  = 天井
 *   4  = 片側プラットフォーム（上から乗れる・下から抜けられる）
 *   5  = 梯子（上下移動）
 *   6  = 梯子トップ（乗り降り地点）
 *   7  = 落下穴（触れたらダメージゾーン）
 *   8  = 棘（ダメージタイル）
 *   9  = ワープポイント（出口）
 *   10 = ロッカー（背景装飾・当たり判定あり）
 *   11 = 窓（背景装飾・抜け不可）
 *   12 = 黒板（背景装飾・抜け不可）
 *   13 = 移動床マーカー（MovingPlatform始点）
 *   14 = 破壊可能ブロック
 *   15 = バネ床（高くジャンプ）
 * ─────────────────────────────────────────────────────────────────────────────
 */

import Phaser from 'phaser';

export const TS = 16; // タイルサイズ（px）

// ─── タイル定義 ─────────────────────────────

export const enum TileID {
  EMPTY      = 0,
  FLOOR      = 1,
  WALL       = 2,
  CEILING    = 3,
  PLATFORM   = 4,
  LADDER     = 5,
  LADDER_TOP = 6,
  PIT        = 7,
  SPIKE      = 8,
  WARP       = 9,
  LOCKER     = 10,
  WINDOW     = 11,
  BOARD      = 12,
  MOVER_H    = 13, // 水平移動床
  MOVER_V    = 14, // 垂直移動床
  BREAKABLE  = 15,
  SPRING     = 16,
}

export interface TileProps {
  solid: boolean;
  platformOnly: boolean; // 上面のみ衝突
  climbable: boolean;    // 梯子
  damage: number;        // ダメージタイル
  warp: boolean;
  spring: boolean;
  breakable: boolean;
  visualOnly: boolean;
}

export const TILE_PROPS: Record<number, TileProps> = {
  [TileID.EMPTY]:      { solid:false, platformOnly:false, climbable:false, damage:0,   warp:false, spring:false, breakable:false, visualOnly:false },
  [TileID.FLOOR]:      { solid:true,  platformOnly:false, climbable:false, damage:0,   warp:false, spring:false, breakable:false, visualOnly:false },
  [TileID.WALL]:       { solid:true,  platformOnly:false, climbable:false, damage:0,   warp:false, spring:false, breakable:false, visualOnly:false },
  [TileID.CEILING]:    { solid:true,  platformOnly:false, climbable:false, damage:0,   warp:false, spring:false, breakable:false, visualOnly:false },
  [TileID.PLATFORM]:   { solid:false, platformOnly:true,  climbable:false, damage:0,   warp:false, spring:false, breakable:false, visualOnly:false },
  [TileID.LADDER]:     { solid:false, platformOnly:false, climbable:true,  damage:0,   warp:false, spring:false, breakable:false, visualOnly:false },
  [TileID.LADDER_TOP]: { solid:false, platformOnly:true,  climbable:true,  damage:0,   warp:false, spring:false, breakable:false, visualOnly:false },
  [TileID.PIT]:        { solid:false, platformOnly:false, climbable:false, damage:99,  warp:false, spring:false, breakable:false, visualOnly:false },
  [TileID.SPIKE]:      { solid:false, platformOnly:false, climbable:false, damage:20,  warp:false, spring:false, breakable:false, visualOnly:false },
  [TileID.WARP]:       { solid:false, platformOnly:false, climbable:false, damage:0,   warp:true,  spring:false, breakable:false, visualOnly:false },
  [TileID.LOCKER]:     { solid:true,  platformOnly:false, climbable:false, damage:0,   warp:false, spring:false, breakable:false, visualOnly:false },
  [TileID.WINDOW]:     { solid:true,  platformOnly:false, climbable:false, damage:0,   warp:false, spring:false, breakable:false, visualOnly:true  },
  [TileID.BOARD]:      { solid:true,  platformOnly:false, climbable:false, damage:0,   warp:false, spring:false, breakable:false, visualOnly:true  },
  [TileID.MOVER_H]:    { solid:false, platformOnly:true,  climbable:false, damage:0,   warp:false, spring:false, breakable:false, visualOnly:false },
  [TileID.MOVER_V]:    { solid:false, platformOnly:true,  climbable:false, damage:0,   warp:false, spring:false, breakable:false, visualOnly:false },
  [TileID.BREAKABLE]:  { solid:true,  platformOnly:false, climbable:false, damage:0,   warp:false, spring:false, breakable:true,  visualOnly:false },
  [TileID.SPRING]:     { solid:false, platformOnly:true,  climbable:false, damage:0,   warp:false, spring:true,  breakable:false, visualOnly:false },
};

// ─── レベルデータ型 ──────────────────────────

export interface LevelLayer {
  name: string;
  data: number[][];  // [row][col] → TileID
}

export interface MovingPlatformDef {
  tileX: number; tileY: number;  // マップ座標（タイル単位）
  width: number;                  // タイル幅
  axis: 'h' | 'v';
  range: number;                  // 移動量（タイル単位）
  speed: number;                  // px/s
}

export interface WarpDef {
  fromX: number; fromY: number;
  toX: number;   toY: number;
  label?: string;
}

export interface LevelDef {
  name: string;
  mapWidth: number;   // タイル列数
  mapHeight: number;  // タイル行数
  bgColor: number;
  gravity: number;
  playerStart: { x: number; y: number };  // タイル座標
  layers: LevelLayer[];
  movingPlatforms: MovingPlatformDef[];
  warps: WarpDef[];
  enemies: EnemySpawnDef[];
}

export interface EnemySpawnDef {
  tileX: number; tileY: number;
  type: 'thug' | 'thug_red' | 'boss';
  triggerTileX?: number;
}

// ─── タイル描画関数 ──────────────────────────

type Ctx = CanvasRenderingContext2D;

function px(ctx: Ctx, x: number, y: number, c: string, a = 1) {
  ctx.globalAlpha = a;
  ctx.fillStyle = c;
  ctx.fillRect(x, y, 1, 1);
  ctx.globalAlpha = 1;
}
function rect(ctx: Ctx, x: number, y: number, w: number, h: number, c: string, a = 1) {
  ctx.globalAlpha = a;
  ctx.fillStyle = c;
  ctx.fillRect(x, y, w, h);
  ctx.globalAlpha = 1;
}

function drawTile(ctx: Ctx, id: number, ox: number, oy: number) {
  const S = TS;
  switch (id) {
    case TileID.EMPTY: break;

    case TileID.FLOOR:
      rect(ctx, ox, oy,     S, S,   '#2a2040');
      rect(ctx, ox, oy,     S, 3,   '#6a5a90');
      rect(ctx, ox, oy+3,   S, 1,   '#4a3a70');
      for (let x = 0; x < S; x += 8) {
        rect(ctx, ox+x, oy+5, 1, S-5, '#231832', 0.3);
      }
      break;

    case TileID.WALL:
      rect(ctx, ox, oy, S, S, '#22183a');
      for (let y = 0; y < S; y += 4) {
        rect(ctx, ox, oy+y, S, 1, '#2e2050', 0.7);
      }
      rect(ctx, ox+S-2, oy, 2, S, '#1a1028', 0.5);
      break;

    case TileID.CEILING:
      rect(ctx, ox, oy,     S, S,   '#2a2040');
      rect(ctx, ox, oy+S-3, S, 3,   '#6a5a90');
      rect(ctx, ox, oy+S-4, S, 1,   '#4a3a70');
      // 天井ライト
      if (Math.floor(ox/S) % 4 === 0) {
        rect(ctx, ox+2, oy+S-5, 12, 3, '#ffee88', 0.8);
        rect(ctx, ox+4, oy+S-6, 8,  2, '#ffffff', 0.4);
      }
      break;

    case TileID.PLATFORM:
      rect(ctx, ox, oy,   S, 4,   '#5a4a80');
      rect(ctx, ox, oy,   S, 2,   '#8a7ab0');
      rect(ctx, ox, oy+4, S, S-4, '#3a2a60', 0.6);
      for (let x = 0; x < S; x += 4) {
        rect(ctx, ox+x, oy+2, 1, 2, '#aaaadd', 0.3);
      }
      break;

    case TileID.LADDER:
      rect(ctx, ox, oy, S, S, '#0a0a1a', 0);    // 透明背景
      rect(ctx, ox+3,  oy, 2, S, '#886644');      // 左柱
      rect(ctx, ox+11, oy, 2, S, '#886644');      // 右柱
      for (let y = 2; y < S; y += 4) {
        rect(ctx, ox+3, oy+y, 10, 1, '#aa8855');  // 横桟
      }
      break;

    case TileID.LADDER_TOP:
      // プラットフォーム上面 + 梯子
      rect(ctx, ox, oy,   S, 4,   '#5a4a80');
      rect(ctx, ox, oy,   S, 2,   '#8a7ab0');
      rect(ctx, ox+3,  oy+4, 2, S-4, '#886644');
      rect(ctx, ox+11, oy+4, 2, S-4, '#886644');
      for (let y = 6; y < S; y += 4) {
        rect(ctx, ox+3, oy+y, 10, 1, '#aa8855');
      }
      break;

    case TileID.PIT:
      rect(ctx, ox, oy, S, S, '#0a0005');
      for (let i = 0; i < 4; i++) {
        rect(ctx, ox+i*4, oy, 2, S, '#1a000a', 0.5);
      }
      break;

    case TileID.SPIKE:
      rect(ctx, ox, oy+10, S, 6,   '#333');
      for (let i = 0; i < 4; i++) {
        // 三角棘
        ctx.fillStyle = '#cc2222';
        ctx.beginPath();
        ctx.moveTo(ox+1+i*4, oy+10);
        ctx.lineTo(ox+3+i*4, oy+2);
        ctx.lineTo(ox+5+i*4, oy+10);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#ff4444';
        ctx.beginPath();
        ctx.moveTo(ox+2+i*4, oy+10);
        ctx.lineTo(ox+3+i*4, oy+4);
        ctx.lineTo(ox+4+i*4, oy+10);
        ctx.closePath();
        ctx.fill();
      }
      break;

    case TileID.WARP:
      rect(ctx, ox, oy, S, S, '#110022');
      // 渦巻き風エフェクト
      ctx.strokeStyle = '#9944ff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(ox+S/2, oy+S/2, 5, 0, Math.PI*2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(ox+S/2, oy+S/2, 3, 0, Math.PI*2);
      ctx.stroke();
      rect(ctx, ox+6, oy+6, 4, 4, '#cc66ff', 0.8);
      rect(ctx, ox+7, oy+7, 2, 2, '#ffffff', 0.9);
      break;

    case TileID.LOCKER:
      rect(ctx, ox,   oy,   S, S, '#304060');
      rect(ctx, ox+1, oy,   7, S, '#405070');
      rect(ctx, ox+8, oy,   7, S, '#405070');
      rect(ctx, ox,   oy+S/2, S, 1, '#202840');
      rect(ctx, ox+S/2, oy, 1, S, '#202840');
      rect(ctx, ox+5, oy+4, 2, 2,  '#88aacc', 0.8);
      rect(ctx, ox+5, oy+4+S/2, 2, 2, '#88aacc', 0.8);
      ctx.strokeStyle = '#203050';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(ox+0.5, oy+0.5, S-1, S-1);
      break;

    case TileID.WINDOW:
      rect(ctx, ox, oy, S, S, '#22183a');
      rect(ctx, ox+2, oy+2, 12, 12, '#88ccee', 0.3);
      rect(ctx, ox+2, oy+2, 12, 1,  '#aaddff', 0.6);
      rect(ctx, ox+2, oy+2, 1,  12, '#aaddff', 0.4);
      rect(ctx, ox+7, oy+2, 1,  12, '#557799', 0.5);
      rect(ctx, ox+2, oy+8, 12, 1,  '#557799', 0.5);
      break;

    case TileID.BOARD:
      rect(ctx, ox, oy, S, S, '#1e3828');
      rect(ctx, ox+1, oy+1, S-2, S-2, '#224030');
      rect(ctx, ox, oy, S, 1,  '#553300');
      rect(ctx, ox, oy+S-1, S, 1, '#553300');
      // チョーク文字っぽいライン
      for (let i = 0; i < 3; i++) {
        rect(ctx, ox+2, oy+4+i*4, 12, 1, '#ddddc0', 0.4);
      }
      break;

    case TileID.BREAKABLE:
      rect(ctx, ox, oy, S, S, '#6a5a30');
      rect(ctx, ox, oy, S, 1,  '#9a8a50');
      rect(ctx, ox, oy, 1, S,  '#9a8a50');
      rect(ctx, ox+S-1, oy, 1, S, '#3a2a10');
      rect(ctx, ox, oy+S-1, S, 1, '#3a2a10');
      // ひび
      ctx.strokeStyle = '#3a2a10';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(ox+4, oy+2); ctx.lineTo(ox+8, oy+8);
      ctx.moveTo(ox+8, oy+8); ctx.lineTo(ox+5, oy+14);
      ctx.moveTo(ox+8, oy+8); ctx.lineTo(ox+13,oy+6);
      ctx.stroke();
      break;

    case TileID.SPRING:
      rect(ctx, ox, oy+10, S, 6, '#444466');
      rect(ctx, ox+3, oy+4, 10, 6, '#6666aa');
      for (let y = 5; y < 10; y += 2) {
        rect(ctx, ox+3, oy+y, 10, 1, '#8888cc', 0.6);
      }
      rect(ctx, ox+2, oy+3, 12, 2, '#aaaadd');
      break;
  }
}

// ─── タイルシート生成 ────────────────────────

export function generateTileSheet(): HTMLCanvasElement {
  const COLS = 8;
  const TILE_COUNT = 17;
  const ROWS = Math.ceil(TILE_COUNT / COLS);
  const canvas = document.createElement('canvas');
  canvas.width  = COLS * TS;
  canvas.height = ROWS * TS;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  for (let id = 0; id < TILE_COUNT; id++) {
    const col = id % COLS;
    const row = Math.floor(id / COLS);
    drawTile(ctx, id, col * TS, row * TS);
  }
  return canvas;
}

// ─── 移動プラットフォーム ───────────────────

export class MovingPlatform {
  public body: Phaser.Physics.Arcade.Image;
  private axis: 'h' | 'v';
  private range: number;
  private speed: number;
  private startX: number;
  private startY: number;
  private dir: number = 1;
  private gfx: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, def: MovingPlatformDef, group: Phaser.Physics.Arcade.StaticGroup) {
    const wx = def.tileX * TS + def.width * TS / 2;
    const wy = def.tileY * TS + TS / 2;
    this.startX = wx;
    this.startY = wy;
    this.axis   = def.axis;
    this.range  = def.range * TS;
    this.speed  = def.speed;

    // 1×1 invisible physics body (will be manually positioned)
    this.body = scene.physics.add.image(wx, wy, '__DEFAULT')
      .setVisible(false)
      .setImmovable(true)
      .setDisplaySize(def.width * TS, TS);
    (this.body.body as Phaser.Physics.Arcade.Body).allowGravity = false;
    (this.body.body as Phaser.Physics.Arcade.Body).setSize(def.width * TS, 4);
    (this.body.body as Phaser.Physics.Arcade.Body).setOffset(0, 0);

    // Visual
    this.gfx = scene.add.graphics().setDepth(3);
    this.drawVisual(wx - def.width * TS / 2, wy - TS / 2, def.width * TS);
  }

  private drawVisual(ox: number, oy: number, w: number) {
    this.gfx.clear();
    this.gfx.fillStyle(0x7766aa, 1);
    this.gfx.fillRect(ox, oy, w, TS);
    this.gfx.fillStyle(0xaa99dd, 1);
    this.gfx.fillRect(ox, oy, w, 3);
    this.gfx.lineStyle(1, 0x9988cc, 0.8);
    this.gfx.strokeRect(ox, oy, w, TS);
    // 矢印で移動方向を示す
    const cx = ox + w / 2, cy = oy + TS / 2;
    this.gfx.fillStyle(0xffffff, 0.3);
    if (this.axis === 'h') {
      this.gfx.fillTriangle(cx-4, cy, cx, cy-3, cx, cy+3);
      this.gfx.fillTriangle(cx+4, cy, cx, cy-3, cx, cy+3);
    } else {
      this.gfx.fillTriangle(cx, cy-4, cx-3, cy, cx+3, cy);
      this.gfx.fillTriangle(cx, cy+4, cx-3, cy, cx+3, cy);
    }
  }

  update(delta: number) {
    const dt = delta / 1000;
    const dist = this.speed * dt * this.dir;

    let nx = this.body.x;
    let ny = this.body.y;

    if (this.axis === 'h') {
      nx += dist;
      const lo = this.startX - this.range / 2;
      const hi = this.startX + this.range / 2;
      if (nx < lo) { nx = lo; this.dir = 1; }
      if (nx > hi) { nx = hi; this.dir = -1; }
    } else {
      ny += dist;
      const lo = this.startY - this.range / 2;
      const hi = this.startY + this.range / 2;
      if (ny < lo) { ny = lo; this.dir = 1; }
      if (ny > hi) { ny = hi; this.dir = -1; }
    }

    this.body.setPosition(nx, ny);
    (this.body.body as Phaser.Physics.Arcade.Body).reset(nx, ny);

    const hw = (this.body.displayWidth ?? TS * 2) / 2;
    const hh = TS / 2;
    this.drawVisual(nx - hw, ny - hh, hw * 2);
  }

  destroy() {
    this.body.destroy();
    this.gfx.destroy();
  }
}

// ─── タイルマップ本体 ────────────────────────

export class TileMap {
  private scene: Phaser.Scene;
  private def: LevelDef;

  // レイヤー別グラフィクス
  private bgGfx!:   Phaser.GameObjects.Graphics;  // 背景（装飾）
  private mainGfx!: Phaser.GameObjects.Graphics;  // メイン地形
  private fgGfx!:   Phaser.GameObjects.Graphics;  // 前景（レイヤー）

  // 物理オブジェクト
  public solidGroup!:    Phaser.Physics.Arcade.StaticGroup;
  public platformGroup!: Phaser.Physics.Arcade.StaticGroup;
  public ladderGroup!:   Phaser.Physics.Arcade.StaticGroup;
  public hazardGroup!:   Phaser.Physics.Arcade.StaticGroup;
  public warpGroup!:     Phaser.Physics.Arcade.StaticGroup;
  public springGroup!:   Phaser.Physics.Arcade.StaticGroup;

  // 移動プラットフォーム
  public movingPlatforms: MovingPlatform[] = [];

  // ブレイカブルブロック
  private breakableBlocks: Map<string, Phaser.GameObjects.Graphics> = new Map();

  // レベルピクセル寸法
  public get pixelWidth()  { return this.def.mapWidth  * TS; }
  public get pixelHeight() { return this.def.mapHeight * TS; }

  constructor(scene: Phaser.Scene, def: LevelDef) {
    this.scene = scene;
    this.def   = def;
    this.build();
  }

  private build() {
    const { mapWidth, mapHeight } = this.def;
    const scene = this.scene;

    // グラフィクスレイヤー作成
    this.bgGfx   = scene.add.graphics().setDepth(1);
    this.mainGfx = scene.add.graphics().setDepth(3);
    this.fgGfx   = scene.add.graphics().setDepth(5);

    // 物理グループ
    this.solidGroup    = scene.physics.add.staticGroup();
    this.platformGroup = scene.physics.add.staticGroup();
    this.ladderGroup   = scene.physics.add.staticGroup();
    this.hazardGroup   = scene.physics.add.staticGroup();
    this.warpGroup     = scene.physics.add.staticGroup();
    this.springGroup   = scene.physics.add.staticGroup();

    // タイルシートをテクスチャとして登録
    if (!scene.textures.exists('tilesheet')) {
      const ts = generateTileSheet();
      scene.textures.addCanvas('tilesheet', ts);
      // フレーム分割
      const tex = scene.textures.get('tilesheet');
      const COLS = 8;
      for (let id = 0; id < 17; id++) {
        const col = id % COLS;
        const row = Math.floor(id / COLS);
        tex.add(`t${id}`, 0, col * TS, row * TS, TS, TS);
      }
    }

    // 全レイヤーをレンダリング
    for (const layer of this.def.layers) {
      this.renderLayer(layer, mapWidth, mapHeight);
    }

    // 移動プラットフォームを生成
    for (const mpDef of this.def.movingPlatforms) {
      this.movingPlatforms.push(new MovingPlatform(scene, mpDef, this.solidGroup));
    }

    // 背景装飾
    this.addLevelDecorations();
  }

  private renderLayer(layer: LevelLayer, cols: number, rows: number) {
    for (let row = 0; row < rows && row < layer.data.length; row++) {
      for (let col = 0; col < cols && col < layer.data[row].length; col++) {
        const id = layer.data[row][col];
        if (id === TileID.EMPTY) continue;

        const wx = col * TS;  // ワールド座標
        const wy = row * TS;
        const cx = wx + TS / 2;
        const cy = wy + TS / 2;

        // 描画
        const gfx = (id === TileID.WINDOW || id === TileID.BOARD)
          ? this.bgGfx : this.mainGfx;
        this.drawTileAt(gfx, id, wx, wy);

        // 物理ボディ追加
        this.addPhysicsBody(id, col, row, wx, wy, cx, cy);
      }
    }
  }

  private drawTileAt(gfx: Phaser.GameObjects.Graphics, id: number, ox: number, oy: number) {
    // Phaser.GameObjects.Graphics にキャンバス関数を模倣して描画
    // tilesheet テクスチャから addImage で描画する方式に変更
    // Graphics ではなく Image を使うと最も効率的
    const img = this.scene.add.image(ox + TS/2, oy + TS/2, 'tilesheet', `t${id}`)
      .setOrigin(0.5)
      .setDepth(id === TileID.WINDOW || id === TileID.BOARD ? 1 : 3);
    // ブレイカブルブロックは参照を保存
    if (id === TileID.BREAKABLE) {
      const key = `${Math.floor(ox/TS)}_${Math.floor(oy/TS)}`;
      // イメージへの参照として保存（破壊時に隠す）
      (img as any).__breakKey = key;
      this.scene.data.set(`break_${key}`, img);
    }
  }

  private addPhysicsBody(id: number, col: number, row: number, wx: number, wy: number, cx: number, cy: number) {
    const S = TS;
    const props = TILE_PROPS[id] ?? TILE_PROPS[TileID.EMPTY];

    if (id === TileID.EMPTY) return;

    // 各グループへ追加
    const addToGroup = (
      group: Phaser.Physics.Arcade.StaticGroup,
      bx: number, by: number, bw: number, bh: number
    ) => {
      const body = this.scene.add.rectangle(bx, by, bw, bh).setVisible(false);
      group.add(body as any);
      const sb = (body as any).body as Phaser.Physics.Arcade.StaticBody;
      sb.reset(bx, by);
      return body;
    };

    if (props.solid && !props.platformOnly && !props.visualOnly) {
      addToGroup(this.solidGroup, cx, cy, S, S);
    }
    if (props.platformOnly) {
      // 上面のみ4px厚さ
      addToGroup(this.platformGroup, cx, wy + 2, S, 4);
    }
    if (props.climbable) {
      addToGroup(this.ladderGroup, cx, cy, S, S);
    }
    if (props.damage > 0) {
      const rect = addToGroup(this.hazardGroup, cx, cy, S, S);
      (rect as any).__damage = props.damage;
    }
    if (props.warp) {
      addToGroup(this.warpGroup, cx, cy, S, S);
    }
    if (props.spring) {
      addToGroup(this.springGroup, cx, cy, S, S);
    }
    if (props.breakable) {
      addToGroup(this.solidGroup, cx, cy, S, S);
    }
  }

  // ─── ブレイカブルブロック破壊 ───────────────

  breakTileAt(tileX: number, tileY: number) {
    const key = `${tileX}_${tileY}`;
    const img = this.scene.data.get(`break_${key}`) as Phaser.GameObjects.Image;
    if (!img) return;
    img.destroy();
    this.scene.data.remove(`break_${key}`);
    // 破片パーティクル
    this.spawnBreakFX(tileX * TS + TS/2, tileY * TS + TS/2);
    // TODO: solidGroup から対応ボディを削除（現在は再構築が必要なため静的）
  }

  private spawnBreakFX(wx: number, wy: number) {
    for (let i = 0; i < 6; i++) {
      const gfx = this.scene.add.graphics().setDepth(20);
      gfx.fillStyle(0x8a7a50, 1);
      gfx.fillRect(0, 0, 4, 4);
      const vx = (Math.random() - 0.5) * 160;
      const vy = -80 - Math.random() * 80;
      gfx.setPosition(wx, wy);
      this.scene.tweens.add({
        targets: gfx, x: wx + vx, y: wy + vy + 60,
        alpha: 0, duration: 500, ease: 'Power2',
        onComplete: () => gfx.destroy()
      });
    }
  }

  // ─── 装飾 ────────────────────────────────────

  private addLevelDecorations() {
    const scene = this.scene;
    const W = this.pixelWidth;
    const H = this.pixelHeight;

    // 床と壁の影・グラウンドライン
    const shadowGfx = scene.add.graphics().setDepth(4);
    shadowGfx.fillStyle(0x000000, 0.15);
    // 各ソリッドタイルの右辺と底辺にシャドウ
    for (const layer of this.def.layers) {
      for (let row = 0; row < layer.data.length; row++) {
        for (let col = 0; col < layer.data[row].length; col++) {
          const id = layer.data[row][col];
          if (id === TileID.EMPTY) continue;
          const props = TILE_PROPS[id];
          if (!props?.solid || props.visualOnly) continue;
          shadowGfx.fillRect(col * TS + TS - 1, row * TS, 2, TS);  // 右辺
          shadowGfx.fillRect(col * TS, row * TS + TS - 1, TS, 2);  // 底辺
        }
      }
    }
  }

  // ─── 毎フレーム更新 ─────────────────────────

  update(delta: number) {
    for (const mp of this.movingPlatforms) {
      mp.update(delta);
    }
  }

  // ─── タイル座標変換 ─────────────────────────

  worldToTile(wx: number, wy: number): { col: number; row: number } {
    return { col: Math.floor(wx / TS), row: Math.floor(wy / TS) };
  }

  tileToWorld(col: number, row: number): { x: number; y: number } {
    return { x: col * TS + TS / 2, y: row * TS + TS / 2 };
  }

  getTileAt(col: number, row: number, layerName = 'main'): number {
    const layer = this.def.layers.find(l => l.name === layerName);
    if (!layer) return TileID.EMPTY;
    if (row < 0 || row >= layer.data.length) return TileID.EMPTY;
    if (col < 0 || col >= (layer.data[row]?.length ?? 0)) return TileID.EMPTY;
    return layer.data[row][col] ?? TileID.EMPTY;
  }

  /** プレイヤーが梯子タイルの中にいるか判定 */
  isOnLadder(worldX: number, worldY: number): boolean {
    const { col, row } = this.worldToTile(worldX, worldY);
    const id = this.getTileAt(col, row);
    return id === TileID.LADDER || id === TileID.LADDER_TOP;
  }

  /** ワープ先を取得 */
  getWarpDest(worldX: number, worldY: number): { x: number; y: number } | null {
    const { col, row } = this.worldToTile(worldX, worldY);
    for (const w of this.def.warps) {
      if (w.fromX === col && w.fromY === row) {
        return { x: w.toX * TS + TS / 2, y: w.toY * TS + TS / 2 };
      }
    }
    return null;
  }
}
