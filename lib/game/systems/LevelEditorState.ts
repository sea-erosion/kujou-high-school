/**
 * LevelEditorState.ts
 * ───────────────────────────────────────────────────────────────────────────
 * エディタの状態管理
 *   - タイルマップデータ（2D配列）
 *   - 敵・移動床・ワープ配置
 *   - Undo / Redo スタック
 *   - localStorage への保存・読み込み
 *   - GameScene 用 LevelDef へのエクスポート
 * ───────────────────────────────────────────────────────────────────────────
 */

import { LevelDef, LevelLayer, EnemySpawnDef, MovingPlatformDef, WarpDef, TS } from './TileSystem';

export const EDITOR_STORAGE_KEY = 'kujou_custom_levels';
export const MAX_UNDO = 60;

// エディタが扱うオブジェクト種別
export type EditorObjectType =
  | 'player_start'
  | 'enemy_thug'
  | 'enemy_thug_red'
  | 'enemy_boss'
  | 'mover_h'
  | 'mover_v'
  | 'warp_from'
  | 'warp_to';

export interface EditorObject {
  id: string;
  type: EditorObjectType;
  tileX: number;
  tileY: number;
  width?: number;   // 移動床の幅（タイル数）
  range?: number;   // 移動範囲（タイル数）
  speed?: number;   // 移動速度
  warpId?: number;  // warp_fromとwarp_toのペアリング用
}

export interface EditorSnapshot {
  tiles: number[][];
  objects: EditorObject[];
  mapWidth: number;
  mapHeight: number;
  bgColor: number;
  gravity: number;
  name: string;
}

export interface SavedLevel {
  id: string;
  name: string;
  createdAt: number;
  snapshot: EditorSnapshot;
}

// ─── デフォルトマップ生成 ─────────────────────

export function makeDefaultMap(cols: number, rows: number): number[][] {
  const data: number[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: number[] = new Array(cols).fill(0);
    if (r === rows - 2) {
      // 下から2行目＝メイン地面
      for (let c = 0; c < cols; c++) row[c] = 1;
    } else if (r === rows - 1) {
      // 最下行＝壁（底抜け防止）
      for (let c = 0; c < cols; c++) row[c] = 2;
    } else if (r === 0) {
      // 最上行＝天井
      for (let c = 0; c < cols; c++) row[c] = 3;
    } else {
      // 左右＝壁
      row[0] = 2;
      row[cols - 1] = 2;
    }
    data.push(row);
  }
  return data;
}

// ─── エディタ状態クラス ───────────────────────

export class LevelEditorState {
  public tiles: number[][];
  public objects: EditorObject[] = [];
  public mapWidth: number;
  public mapHeight: number;
  public bgColor: number = 0x0a0a1a;
  public gravity: number = 900;
  public name: string = 'マイコース';

  private undoStack: EditorSnapshot[] = [];
  private redoStack: EditorSnapshot[] = [];
  private _nextObjId: number = 1;

  constructor(cols = 60, rows = 30) {
    this.mapWidth  = cols;
    this.mapHeight = rows;
    this.tiles = makeDefaultMap(cols, rows);
    // デフォルトのプレイヤースタート位置
    this.objects.push({
      id: this.nextId(),
      type: 'player_start',
      tileX: 3,
      tileY: rows - 3,
    });
  }

  private nextId(): string {
    return `obj_${this._nextObjId++}`;
  }

  // ─── Undo / Redo ──────────────────────────

  /** 変更前にスナップショットを保存 */
  snapshot() {
    this.undoStack.push(this.toSnapshot());
    if (this.undoStack.length > MAX_UNDO) this.undoStack.shift();
    this.redoStack = [];
  }

  undo(): boolean {
    if (this.undoStack.length === 0) return false;
    this.redoStack.push(this.toSnapshot());
    this.fromSnapshot(this.undoStack.pop()!);
    return true;
  }

  redo(): boolean {
    if (this.redoStack.length === 0) return false;
    this.undoStack.push(this.toSnapshot());
    this.fromSnapshot(this.redoStack.pop()!);
    return true;
  }

  // ─── タイル操作 ───────────────────────────

  setTile(col: number, row: number, id: number) {
    if (!this.inBounds(col, row)) return;
    this.tiles[row][col] = id;
  }

  getTile(col: number, row: number): number {
    if (!this.inBounds(col, row)) return 0;
    return this.tiles[row][col];
  }

  fillRect(col: number, row: number, w: number, h: number, id: number) {
    for (let r = row; r < row + h; r++) {
      for (let c = col; c < col + w; c++) {
        this.setTile(c, r, id);
      }
    }
  }

  /** 塗りつぶし（Flood Fill） */
  floodFill(col: number, row: number, newId: number) {
    const targetId = this.getTile(col, row);
    if (targetId === newId) return;
    const stack: [number, number][] = [[col, row]];
    const visited = new Set<string>();
    while (stack.length > 0) {
      const [c, r] = stack.pop()!;
      const key = `${c},${r}`;
      if (visited.has(key)) continue;
      if (!this.inBounds(c, r)) continue;
      if (this.getTile(c, r) !== targetId) continue;
      visited.add(key);
      this.setTile(c, r, newId);
      stack.push([c+1,r],[c-1,r],[c,r+1],[c,r-1]);
    }
  }

  // ─── オブジェクト操作 ─────────────────────

  addObject(type: EditorObjectType, tileX: number, tileY: number, extra?: Partial<EditorObject>): EditorObject {
    // プレイヤースタートは1つのみ
    if (type === 'player_start') {
      this.objects = this.objects.filter(o => o.type !== 'player_start');
    }
    const obj: EditorObject = {
      id: this.nextId(),
      type,
      tileX,
      tileY,
      ...extra,
    };
    this.objects.push(obj);
    return obj;
  }

  removeObjectAt(tileX: number, tileY: number) {
    this.objects = this.objects.filter(
      o => !(o.tileX === tileX && o.tileY === tileY)
    );
  }

  getObjectAt(tileX: number, tileY: number): EditorObject | undefined {
    return this.objects.find(o => o.tileX === tileX && o.tileY === tileY);
  }

  // ─── シリアライズ ─────────────────────────

  toSnapshot(): EditorSnapshot {
    return {
      tiles: this.tiles.map(row => [...row]),
      objects: this.objects.map(o => ({ ...o })),
      mapWidth: this.mapWidth,
      mapHeight: this.mapHeight,
      bgColor: this.bgColor,
      gravity: this.gravity,
      name: this.name,
    };
  }

  fromSnapshot(snap: EditorSnapshot) {
    this.tiles     = snap.tiles.map(row => [...row]);
    this.objects   = snap.objects.map(o => ({ ...o }));
    this.mapWidth  = snap.mapWidth;
    this.mapHeight = snap.mapHeight;
    this.bgColor   = snap.bgColor;
    this.gravity   = snap.gravity;
    this.name      = snap.name;
  }

  // ─── LevelDef エクスポート ────────────────

  toLevelDef(): LevelDef {
    // プレイヤースタート
    const startObj = this.objects.find(o => o.type === 'player_start');
    const playerStart = startObj
      ? { x: startObj.tileX, y: startObj.tileY }
      : { x: 2, y: this.mapHeight - 3 };

    // 敵
    const enemies: EnemySpawnDef[] = this.objects
      .filter(o => o.type.startsWith('enemy_'))
      .map(o => ({
        tileX: o.tileX,
        tileY: o.tileY,
        type: (o.type === 'enemy_thug'     ? 'thug'
             : o.type === 'enemy_thug_red' ? 'thug_red'
             :                               'boss') as 'thug' | 'thug_red' | 'boss',
      }));

    // 移動床
    const movingPlatforms: MovingPlatformDef[] = this.objects
      .filter(o => o.type === 'mover_h' || o.type === 'mover_v')
      .map(o => ({
        tileX: o.tileX,
        tileY: o.tileY,
        width: o.width ?? 4,
        axis:  o.type === 'mover_h' ? 'h' : 'v',
        range: o.range ?? 5,
        speed: o.speed ?? 60,
      }));

    // ワープ（from/toペアリング）
    const warps: WarpDef[] = [];
    const warpFroms = this.objects.filter(o => o.type === 'warp_from');
    const warpTos   = this.objects.filter(o => o.type === 'warp_to');
    warpFroms.forEach(f => {
      const t = warpTos.find(w => w.warpId === f.warpId) ?? warpTos[0];
      if (t) {
        warps.push({ fromX: f.tileX, fromY: f.tileY, toX: t.tileX, toY: t.tileY });
      }
    });

    return {
      name: this.name,
      mapWidth:  this.mapWidth,
      mapHeight: this.mapHeight,
      bgColor:   this.bgColor,
      gravity:   this.gravity,
      playerStart,
      layers: [{ name: 'main', data: this.tiles.map(row => [...row]) }],
      movingPlatforms,
      warps,
      enemies,
    };
  }

  // ─── localStorage 保存 ───────────────────

  saveToStorage(id?: string): string {
    const levelId = id ?? `level_${Date.now()}`;
    const saved = this.loadAllFromStorage();
    const idx = saved.findIndex(l => l.id === levelId);
    const entry: SavedLevel = {
      id: levelId,
      name: this.name,
      createdAt: Date.now(),
      snapshot: this.toSnapshot(),
    };
    if (idx >= 0) saved[idx] = entry;
    else saved.push(entry);
    try {
      localStorage.setItem(EDITOR_STORAGE_KEY, JSON.stringify(saved));
    } catch { /* quota exceeded etc. */ }
    return levelId;
  }

  loadFromStorage(id: string): boolean {
    const saved = this.loadAllFromStorage();
    const entry = saved.find(l => l.id === id);
    if (!entry) return false;
    this.fromSnapshot(entry.snapshot);
    return true;
  }

  static loadAllFromStorage(): SavedLevel[] {
    try {
      const raw = localStorage.getItem(EDITOR_STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw) as SavedLevel[];
    } catch { return []; }
  }

  loadAllFromStorage(): SavedLevel[] {
    return LevelEditorState.loadAllFromStorage();
  }

  static deleteFromStorage(id: string) {
    const saved = LevelEditorState.loadAllFromStorage();
    const filtered = saved.filter(l => l.id !== id);
    localStorage.setItem(EDITOR_STORAGE_KEY, JSON.stringify(filtered));
  }

  // ─── ユーティリティ ───────────────────────

  private inBounds(col: number, row: number): boolean {
    return col >= 0 && col < this.mapWidth && row >= 0 && row < this.mapHeight;
  }

  /** マップサイズ変更（端を埋める・切り取る） */
  resize(newCols: number, newRows: number) {
    const newTiles = makeDefaultMap(newCols, newRows);
    for (let r = 0; r < Math.min(newRows, this.mapHeight); r++) {
      for (let c = 0; c < Math.min(newCols, this.mapWidth); c++) {
        newTiles[r][c] = this.tiles[r]?.[c] ?? 0;
      }
    }
    this.tiles     = newTiles;
    this.mapWidth  = newCols;
    this.mapHeight = newRows;
    // 範囲外オブジェクトを削除
    this.objects = this.objects.filter(
      o => o.tileX < newCols && o.tileY < newRows
    );
  }
}
