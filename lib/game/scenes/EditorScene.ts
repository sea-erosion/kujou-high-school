/**
 * EditorScene.ts
 * ───────────────────────────────────────────────────────────────────────────
 * マリオメーカー風コース作成シーン
 *
 * UI構成:
 *   ┌─────────────────────────────────────┐
 *   │ TOOLBAR (top)                       │
 *   │  [TILE]  [OBJECT]  [ERASE]  [FILL]  │
 *   │  [UNDO]  [REDO]    [PLAY]   [SAVE]  │
 *   ├─────────────────────────────────────┤
 *   │                           │ PALETTE │
 *   │   MAP CANVAS (scrollable) │ (right) │
 *   │                           │         │
 *   └─────────────────────────────────────┘
 *
 * 操作:
 *   左クリック＋ドラッグ  = 配置（選択中タイル/オブジェクト）
 *   右クリック            = 削除
 *   中ボタンドラッグ/矢印 = カメラスクロール
 *   Ctrl+Z                = Undo
 *   Ctrl+Y / Ctrl+Shift+Z = Redo
 *   Ctrl+S                = Save
 *   P / Enter             = プレイテスト
 *   E                     = エディタ/プレイ切替
 * ───────────────────────────────────────────────────────────────────────────
 */

import Phaser from 'phaser';
import { TS, LevelDef } from '../systems/TileSystem';
import {
  LevelEditorState,
  EditorObjectType,
  EditorObject,
  SavedLevel,
} from '../systems/LevelEditorState';

// ─── パレットアイテム定義 ─────────────────────

interface PaletteItem {
  id: number | EditorObjectType;
  label: string;
  category: 'tile' | 'object';
  color: number;     // Phaser hex
  icon: string;      // emoji or short text
  description: string;
}

const PALETTE_ITEMS: PaletteItem[] = [
  // ── タイル ──────────────────────────────────
  { id: 0,  label: '消去',   category: 'tile',   color: 0x111122, icon: '✕', description: '空白（削除）' },
  { id: 1,  label: '床',     category: 'tile',   color: 0x5a4a80, icon: '▬', description: '通常の床タイル' },
  { id: 2,  label: '壁',     category: 'tile',   color: 0x3a2a60, icon: '█', description: '壁（全面ソリッド）' },
  { id: 3,  label: '天井',   category: 'tile',   color: 0x4a3a70, icon: '▔', description: '天井タイル' },
  { id: 4,  label: 'PF',     category: 'tile',   color: 0x7766aa, icon: '━', description: '片側プラットフォーム\n（上から乗れる）' },
  { id: 5,  label: '梯子',   category: 'tile',   color: 0x886644, icon: '⬛', description: '梯子（上下移動）' },
  { id: 6,  label: '梯子↑',  category: 'tile',   color: 0xaa8855, icon: '⬜', description: '梯子トップ\n（乗り降り地点）' },
  { id: 7,  label: 'ピット', category: 'tile',   color: 0x220011, icon: '▼', description: '落下穴（即ダメ）' },
  { id: 8,  label: '棘',     category: 'tile',   color: 0x991111, icon: '✦', description: '棘（ダメージ20）' },
  { id: 9,  label: 'ワープ', category: 'tile',   color: 0x8822cc, icon: '◉', description: 'ワープタイル' },
  { id: 10, label: 'ロッカー',category: 'tile',  color: 0x304060, icon: '▮', description: 'ロッカー（背景装飾）' },
  { id: 11, label: '窓',     category: 'tile',   color: 0x334466, icon: '▩', description: '窓（背景装飾）' },
  { id: 12, label: '黒板',   category: 'tile',   color: 0x1e3828, icon: '▣', description: '黒板（背景装飾）' },
  { id: 15, label: '破壊床', category: 'tile',   color: 0x6a5a30, icon: '⬡', description: '攻撃で破壊できる床' },
  { id: 16, label: 'バネ',   category: 'tile',   color: 0x4444aa, icon: '⟳', description: 'バネ床（超高ジャンプ）' },
  // ── オブジェクト ────────────────────────────
  { id: 'player_start',   label: 'スタート', category: 'object', color: 0x44aa44, icon: '⬟', description: 'プレイヤー開始位置\n（1個のみ配置可）' },
  { id: 'enemy_thug',     label: '敵（青）', category: 'object', color: 0x3366cc, icon: '◆', description: 'ザコ敵（青組）HP50' },
  { id: 'enemy_thug_red', label: '敵（赤）', category: 'object', color: 0xcc3333, icon: '◆', description: 'ザコ敵（赤組）HP50\n速くて強い' },
  { id: 'enemy_boss',     label: 'ボス',     category: 'object', color: 0xaa2222, icon: '◈', description: '番長ボスHP200\n配置は1体推奨' },
  { id: 'mover_h',        label: '移動床→', category: 'object', color: 0xaaaa44, icon: '↔', description: '水平移動プラットフォーム' },
  { id: 'mover_v',        label: '移動床↕', category: 'object', color: 0x44aaaa, icon: '↕', description: '垂直移動プラットフォーム' },
  { id: 'warp_from',      label: 'ワープ元', category: 'object', color: 0xcc66ff, icon: '⊙', description: 'ワープ入口\nwarp_toと対応' },
  { id: 'warp_to',        label: 'ワープ先', category: 'object', color: 0xff66cc, icon: '⊕', description: 'ワープ出口' },
];

// パレット表示設定
const PALETTE_W   = 108;   // 右パネル幅
const TOOLBAR_H   = 48;    // 上バー高さ
const TILE_SCALE  = 2;     // マップ表示倍率
const CELL_SIZE   = TS * TILE_SCALE;  // 32px

// ツールモード
type ToolMode = 'pen' | 'erase' | 'fill' | 'select' | 'eyedropper';

// ─── EDITOR SCENE ─────────────────────────────

export class EditorScene extends Phaser.Scene {
  // エディタ状態
  private editorState!: LevelEditorState;
  private currentLevelId: string | null = null;
  private toolMode: ToolMode = 'pen';
  private selectedItem: PaletteItem = PALETTE_ITEMS[1]; // 床

  // 描画オブジェクト
  private mapContainer!: Phaser.GameObjects.Container;
  private tileGraphics!: Phaser.GameObjects.Graphics;
  private gridGraphics!: Phaser.GameObjects.Graphics;
  private objectGraphics!: Phaser.GameObjects.Graphics;
  private cursorGraphics!: Phaser.GameObjects.Graphics;
  private uiCamera!: Phaser.Cameras.Scene2D.Camera;
  private mapCamera!: Phaser.Cameras.Scene2D.Camera;

  // UI要素
  private paletteContainer!: Phaser.GameObjects.Container;
  private toolbarContainer!: Phaser.GameObjects.Container;
  private statusText!: Phaser.GameObjects.Text;
  private levelNameText!: Phaser.GameObjects.Text;
  private coordText!: Phaser.GameObjects.Text;
  private saveListContainer!: Phaser.GameObjects.Container | null;
  private settingsContainer!: Phaser.GameObjects.Container | null;
  private paletteScrollOffset: number = 0;

  // カメラ（マップ）スクロール
  private camScrollX: number = 0;
  private camScrollY: number = 0;
  private isDraggingMap: boolean = false;
  private dragStartX: number = 0;
  private dragStartY: number = 0;
  private dragCamStartX: number = 0;
  private dragCamStartY: number = 0;

  // ペン操作
  private isPainting: boolean = false;
  private isErasing: boolean = false;
  private lastPaintTile: { col: number; row: number } | null = null;

  // 選択範囲
  private selStart: { col: number; row: number } | null = null;
  private selEnd: { col: number; row: number } | null = null;

  // オブジェクトプロパティ編集
  private editingObject: EditorObject | null = null;
  private propPanel: Phaser.GameObjects.Container | null = null;

  constructor() {
    super({ key: 'EditorScene' });
  }

  // ─── CREATE ───────────────────────────────

  create() {
    const { width: W, height: H } = this.scale;

    // アセット確認
    if (!this.textures.exists('tilesheet')) {
      const { loadGeneratedAssets } = require('../assets/SpriteGenerator');
      loadGeneratedAssets(this);
    }
    if (!this.textures.exists('tilesheet')) {
      const { generateTileSheet } = require('../systems/TileSystem');
      const ts = generateTileSheet();
      this.textures.addCanvas('tilesheet', ts);
      const tex = this.textures.get('tilesheet');
      for (let id = 0; id < 17; id++) {
        const col = id % 8, row = Math.floor(id / 8);
        if (!tex.has(`t${id}`)) tex.add(`t${id}`, 0, col * TS, row * TS, TS, TS);
      }
    }

    // 新規エディタ状態
    this.editorState = new LevelEditorState(60, 30);

    // URLパラメータ等でロードするレベルIDがあれば読み込む
    const loadId = (this.scene.settings.data as any)?.loadLevelId;
    if (loadId) {
      this.editorState.loadFromStorage(loadId);
      this.currentLevelId = loadId;
    }

    // ── カメラ設定 ────────────────────────────
    this.setupCameras(W, H);

    // ── マップ描画グラフィクス ─────────────────
    this.mapContainer = this.add.container(0, 0);
    this.mapContainer.setDepth(0);

    this.tileGraphics   = this.add.graphics().setDepth(1);
    this.gridGraphics   = this.add.graphics().setDepth(2);
    this.objectGraphics = this.add.graphics().setDepth(3);
    this.cursorGraphics = this.add.graphics().setDepth(10);

    // ── UI ────────────────────────────────────
    this.buildToolbar(W, H);
    this.buildPalette(W, H);
    this.buildStatusBar(W, H);

    // ── 初期描画 ─────────────────────────────
    this.redrawMap();
    this.redrawObjects();

    // ── 入力 ─────────────────────────────────
    this.setupInput(W, H);

    // 起動バナー
    this.showToast('コース作成モード\n左クリック：配置  右クリック：削除  中ドラッグ：移動\nCtrl+Z：Undo  P：プレイテスト  Ctrl+S：保存', 3000);

    this.cameras.main.fadeIn(300, 0, 0, 0);
  }

  // ─── カメラ設定 ───────────────────────────

  private setupCameras(W: number, H: number) {
    // メインカメラ = マップ描画用
    this.cameras.main.setViewport(0, TOOLBAR_H, W - PALETTE_W, H - TOOLBAR_H);
    this.cameras.main.setBackgroundColor(0x0a0a1a);
    this.cameras.main.setScroll(0, 0);

    // UIカメラ = ツールバー・パレット（スクロールしない）
    this.uiCamera = this.cameras.add(0, 0, W, H);
    this.uiCamera.setScroll(0, 0);
    // UI以外のオブジェクトをUIカメラから除外するのは ignore()で管理
  }

  // ─── ツールバー ───────────────────────────

  private buildToolbar(W: number, H: number) {
    this.toolbarContainer = this.add.container(0, 0).setDepth(100);
    const g = this.add.graphics();
    g.fillStyle(0x1a1530, 1);
    g.fillRect(0, 0, W, TOOLBAR_H);
    g.lineStyle(1, 0x6644aa, 0.8);
    g.lineBetween(0, TOOLBAR_H - 1, W, TOOLBAR_H - 1);
    this.toolbarContainer.add(g);

    // タイトル
    const title = this.add.text(8, 8, '久条高校 コースエディタ', {
      fontSize: '13px', fontFamily: 'monospace', color: '#ccaaff',
    });
    this.toolbarContainer.add(title);

    // レベル名（クリックで編集）
    this.levelNameText = this.add.text(8, 26, `▶ ${this.editorState.name}`, {
      fontSize: '11px', fontFamily: 'monospace', color: '#aaaacc',
    }).setInteractive({ cursor: 'text' });
    this.levelNameText.on('pointerdown', () => this.openNameEditor());
    this.toolbarContainer.add(this.levelNameText);

    // ツールボタン
    const tools: Array<{ label: string; mode: ToolMode | string; x: number; action?: () => void }> = [
      { label: '✏ PEN',       mode: 'pen',        x: 220 },
      { label: '✕ ERASE',     mode: 'erase',      x: 290 },
      { label: '▓ FILL',      mode: 'fill',       x: 365 },
      { label: '⊕ SELECT',    mode: 'select',     x: 435 },
      { label: '↩ UNDO',      mode: 'undo',       x: 530, action: () => this.doUndo() },
      { label: '↪ REDO',      mode: 'redo',       x: 600, action: () => this.doRedo() },
      { label: '▶ PLAY',      mode: 'play',       x: 680, action: () => this.startPlayTest() },
      { label: '💾 SAVE',     mode: 'save',       x: 758, action: () => this.saveLevel() },
      { label: '📂 LOAD',     mode: 'load',       x: 828, action: () => this.openLoadPanel() },
      { label: '⚙ SETTING',  mode: 'settings',   x: 900, action: () => this.openSettings() },
      { label: '← TITLE',    mode: 'title',      x: 980, action: () => this.goToTitle() },
    ];

    tools.forEach(t => {
      const isMode = ['pen','erase','fill','select'].includes(t.mode);
      const btn = this.add.text(t.x, 6, t.label, {
        fontSize: '11px', fontFamily: 'monospace',
        color: '#aaaadd',
        backgroundColor: '#2a2050',
        padding: { x: 6, y: 5 },
      }).setInteractive({ cursor: 'pointer' });

      btn.on('pointerover', () => btn.setStyle({ color: '#ffffff', backgroundColor: '#4a3a80' }));
      btn.on('pointerout', () => {
        const active = isMode && this.toolMode === t.mode;
        btn.setStyle({ color: active ? '#ffee44' : '#aaaadd', backgroundColor: active ? '#3a2a70' : '#2a2050' });
      });
      btn.on('pointerdown', () => {
        if (isMode) {
          this.setToolMode(t.mode as ToolMode);
          this.updateToolbarHighlight(tools.map(tt => tt.mode) as string[], btn, t.mode);
        }
        t.action?.();
      });
      (btn as any).__toolMode = t.mode;
      this.toolbarContainer.add(btn);
    });

    // UIカメラのみで見えるようにする
    this.cameras.main.ignore(this.toolbarContainer);
  }

  private updateToolbarHighlight(modes: string[], activeBtn: Phaser.GameObjects.Text, activeMode: string) {
    this.toolbarContainer.list.forEach(obj => {
      if (obj instanceof Phaser.GameObjects.Text && (obj as any).__toolMode) {
        const m = (obj as any).__toolMode;
        const isActive = m === activeMode;
        obj.setStyle({ color: isActive ? '#ffee44' : '#aaaadd', backgroundColor: isActive ? '#3a2a70' : '#2a2050' });
      }
    });
  }

  private setToolMode(mode: ToolMode) {
    this.toolMode = mode;
    this.showToast(`ツール: ${mode.toUpperCase()}`);
  }

  // ─── パレット ─────────────────────────────

  private buildPalette(W: number, H: number) {
    this.paletteContainer = this.add.container(W - PALETTE_W, 0).setDepth(100);

    // 背景
    const bg = this.add.graphics();
    bg.fillStyle(0x120e25, 1);
    bg.fillRect(0, 0, PALETTE_W, H);
    bg.lineStyle(1, 0x4433aa, 0.8);
    bg.lineBetween(0, 0, 0, H);
    this.paletteContainer.add(bg);

    // ヘッダー
    const hdr = this.add.text(6, 6, 'PALETTE', {
      fontSize: '10px', fontFamily: 'monospace', color: '#8877cc',
    });
    this.paletteContainer.add(hdr);

    // タイルカテゴリラベル
    const tileHdr = this.add.text(6, 24, '── タイル ──', {
      fontSize: '9px', fontFamily: 'monospace', color: '#665588',
    });
    this.paletteContainer.add(tileHdr);

    // アイテムリスト（スクロール対応）
    this.buildPaletteItems(W, H);

    this.cameras.main.ignore(this.paletteContainer);
  }

  private buildPaletteItems(W: number, H: number) {
    const ITEM_H = 30;
    const PW = PALETTE_W;
    let y = 38;
    let lastCategory = 'tile';

    PALETTE_ITEMS.forEach((item, i) => {
      // カテゴリ区切り
      if (item.category !== lastCategory) {
        const sep = this.add.text(6, y, '─ オブジェクト ─', {
          fontSize: '9px', fontFamily: 'monospace', color: '#665588',
        });
        this.paletteContainer.add(sep);
        y += 16;
        lastCategory = item.category;
      }

      const isSelected = this.selectedItem.id === item.id;
      const itemBg = this.add.graphics();
      this.drawPaletteItem(itemBg, 2, y, PW - 4, ITEM_H - 2, item, isSelected);
      (itemBg as any).__paletteIdx = i;
      (itemBg as any).__paletteY   = y;
      itemBg.setInteractive(
        new Phaser.Geom.Rectangle(2, y, PW - 4, ITEM_H - 2),
        Phaser.Geom.Rectangle.Contains
      );
      itemBg.on('pointerdown', () => this.selectPaletteItem(item));
      itemBg.on('pointerover', () => {
        if (this.selectedItem.id !== item.id) {
          this.drawPaletteItem(itemBg, 2, y, PW - 4, ITEM_H - 2, item, false, true);
        }
        this.showItemTooltip(W - PALETTE_W - 160, y + TOOLBAR_H, item);
      });
      itemBg.on('pointerout', () => {
        this.drawPaletteItem(itemBg, 2, y, PW - 4, ITEM_H - 2, item, this.selectedItem.id === item.id);
        this.hideTooltip();
      });
      this.paletteContainer.add(itemBg);

      const icon = this.add.text(8, y + 8, item.icon, {
        fontSize: '12px', fontFamily: 'monospace', color: `#${item.color.toString(16).padStart(6,'0')}`,
      });
      const label = this.add.text(26, y + 7, item.label, {
        fontSize: '10px', fontFamily: 'monospace', color: '#ccbbee',
      });
      this.paletteContainer.add(icon);
      this.paletteContainer.add(label);

      y += ITEM_H;
    });
  }

  private drawPaletteItem(
    g: Phaser.GameObjects.Graphics,
    x: number, y: number, w: number, h: number,
    item: PaletteItem,
    selected: boolean,
    hover: boolean = false
  ) {
    g.clear();
    if (selected) {
      g.fillStyle(0x4a3a80, 1);
      g.fillRect(x, y, w, h);
      g.lineStyle(1, 0xaa88ff, 1);
      g.strokeRect(x, y, w, h);
    } else if (hover) {
      g.fillStyle(0x2a2050, 1);
      g.fillRect(x, y, w, h);
    } else {
      g.fillStyle(0x1a1540, 0.5);
      g.fillRect(x, y, w, h);
    }
    // 小さいカラースウォッチ
    g.fillStyle(item.color, 1);
    g.fillRect(x + w - 10, y + 2, 8, h - 4);
  }

  private selectPaletteItem(item: PaletteItem) {
    this.selectedItem = item;
    // 選択ハイライト更新
    this.paletteContainer.list.forEach(obj => {
      if (obj instanceof Phaser.GameObjects.Graphics && (obj as any).__paletteIdx !== undefined) {
        const idx = (obj as any).__paletteIdx;
        const pItem = PALETTE_ITEMS[idx];
        const y = (obj as any).__paletteY;
        const isSelected = pItem.id === item.id;
        this.drawPaletteItem(obj, 2, y, PALETTE_W - 4, 28, pItem, isSelected);
      }
    });
    this.showToast(`選択: ${item.label}`);
    // タイルモードかオブジェクトモードかで自動切替
    if (item.category === 'object' && this.toolMode !== 'erase') {
      this.toolMode = 'pen';
    }
  }

  // ─── ステータスバー ───────────────────────

  private buildStatusBar(W: number, H: number) {
    const bar = this.add.graphics().setDepth(100);
    bar.fillStyle(0x0e0c1e, 1);
    bar.fillRect(0, H - 20, W - PALETTE_W, 20);

    this.statusText = this.add.text(6, H - 16, '', {
      fontSize: '9px', fontFamily: 'monospace', color: '#886699',
    }).setDepth(100);

    this.coordText = this.add.text(W - PALETTE_W - 130, H - 16, '', {
      fontSize: '9px', fontFamily: 'monospace', color: '#665577',
    }).setDepth(100);

    this.cameras.main.ignore([bar, this.statusText, this.coordText]);
  }

  // ─── 入力設定 ─────────────────────────────

  private setupInput(W: number, H: number) {
    const kb = this.input.keyboard!;

    // キーショートカット
    kb.on('keydown', (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' || e.key === 'Z') {
          if (e.shiftKey) this.doRedo();
          else            this.doUndo();
          e.preventDefault();
        }
        if (e.key === 'y' || e.key === 'Y') { this.doRedo(); e.preventDefault(); }
        if (e.key === 's' || e.key === 'S') { this.saveLevel(); e.preventDefault(); }
      } else {
        if (e.key === 'p' || e.key === 'P' || e.key === 'Enter') this.startPlayTest();
        if (e.key === 'e' || e.key === 'E') this.startPlayTest();
        if (e.key === 'Escape') this.closePanels();
        // ツール切替
        if (e.key === '1') this.setToolMode('pen');
        if (e.key === '2') this.setToolMode('erase');
        if (e.key === '3') this.setToolMode('fill');
        if (e.key === '4') this.setToolMode('select');
        // カメラスクロール（キー）
        if (e.key === 'ArrowRight') this.camScrollX += CELL_SIZE * 3;
        if (e.key === 'ArrowLeft')  this.camScrollX -= CELL_SIZE * 3;
        if (e.key === 'ArrowDown')  this.camScrollY += CELL_SIZE * 3;
        if (e.key === 'ArrowUp')    this.camScrollY -= CELL_SIZE * 3;
        this.clampCamera();
      }
    });

    // マウス入力（マップエリア）
    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      if (this.isInMapArea(ptr.x, ptr.y)) {
        if (ptr.middleButtonDown()) {
          this.isDraggingMap = true;
          this.dragStartX = ptr.x; this.dragStartY = ptr.y;
          this.dragCamStartX = this.camScrollX; this.dragCamStartY = this.camScrollY;
        } else if (ptr.leftButtonDown()) {
          this.isPainting = true;
          this.lastPaintTile = null;
          this.handleMapClick(ptr, false);
        } else if (ptr.rightButtonDown()) {
          this.isErasing = true;
          this.handleMapErase(ptr);
        }
      }
    });

    this.input.on('pointermove', (ptr: Phaser.Input.Pointer) => {
      if (this.isDraggingMap) {
        this.camScrollX = this.dragCamStartX - (ptr.x - this.dragStartX);
        this.camScrollY = this.dragCamStartY - (ptr.y - this.dragStartY);
        this.clampCamera();
      } else if (this.isPainting && this.isInMapArea(ptr.x, ptr.y)) {
        this.handleMapClick(ptr, true);
      } else if (this.isErasing && this.isInMapArea(ptr.x, ptr.y)) {
        this.handleMapErase(ptr);
      }
      this.updateCursor(ptr);
      this.updateCoordDisplay(ptr);
    });

    this.input.on('pointerup', () => {
      this.isDraggingMap = false;
      this.isPainting    = false;
      this.isErasing     = false;
      this.lastPaintTile = null;
    });

    // ホイールスクロール
    this.input.on('wheel', (_ptr: Phaser.Input.Pointer, _go: any, _dx: number, dy: number) => {
      this.camScrollY += dy * 0.8;
      this.clampCamera();
    });
  }

  // ─── マップクリック処理 ──────────────────

  private handleMapClick(ptr: Phaser.Input.Pointer, isDrag: boolean) {
    const { col, row } = this.screenToTile(ptr.x, ptr.y);
    if (col < 0 || col >= this.editorState.mapWidth) return;
    if (row < 0 || row >= this.editorState.mapHeight) return;

    // 同じタイルへの連続塗りをスキップ
    if (isDrag && this.lastPaintTile?.col === col && this.lastPaintTile?.row === row) return;
    this.lastPaintTile = { col, row };

    const item = this.selectedItem;

    if (this.toolMode === 'erase') {
      this.editorState.snapshot();
      this.editorState.setTile(col, row, 0);
      this.editorState.removeObjectAt(col, row);
      this.redrawMap();
      this.redrawObjects();
      return;
    }

    if (this.toolMode === 'fill' && !isDrag) {
      this.editorState.snapshot();
      if (item.category === 'tile') {
        this.editorState.floodFill(col, row, item.id as number);
        this.redrawMap();
      }
      return;
    }

    if (this.toolMode === 'eyedropper' && !isDrag) {
      const id = this.editorState.getTile(col, row);
      const found = PALETTE_ITEMS.find(p => p.id === id);
      if (found) this.selectPaletteItem(found);
      return;
    }

    // pen モード
    if (!isDrag || item.category === 'tile') {
      if (item.category === 'tile') {
        if (!isDrag) this.editorState.snapshot();
        this.editorState.setTile(col, row, item.id as number);
        this.redrawTileAt(col, row);
      } else {
        // オブジェクト配置
        if (!isDrag) {
          this.editorState.snapshot();
          this.editorState.removeObjectAt(col, row);
          const extra: Partial<import('../systems/LevelEditorState').EditorObject> = {};
          if (item.id === 'mover_h' || item.id === 'mover_v') {
            extra.width = 4; extra.range = 6; extra.speed = 60;
          }
          if (item.id === 'warp_from' || item.id === 'warp_to') {
            extra.warpId = 1;
          }
          const obj = this.editorState.addObject(item.id as EditorObjectType, col, row, extra);
          // 移動床は即プロパティ編集
          if (item.id === 'mover_h' || item.id === 'mover_v') {
            this.openObjectProperties(obj);
          }
          this.redrawObjects();
        }
      }
    }
  }

  private handleMapErase(ptr: Phaser.Input.Pointer) {
    const { col, row } = this.screenToTile(ptr.x, ptr.y);
    if (col < 0 || col >= this.editorState.mapWidth) return;
    if (row < 0 || row >= this.editorState.mapHeight) return;
    this.editorState.setTile(col, row, 0);
    this.editorState.removeObjectAt(col, row);
    this.redrawTileAt(col, row);
    this.redrawObjects();
  }

  // ─── 座標変換 ─────────────────────────────

  private screenToTile(sx: number, sy: number): { col: number; row: number } {
    // マップエリア内の位置（ツールバー分を除く）
    const mx = sx + this.camScrollX;
    const my = sy - TOOLBAR_H + this.camScrollY;
    return {
      col: Math.floor(mx / CELL_SIZE),
      row: Math.floor(my / CELL_SIZE),
    };
  }

  private tileToScreen(col: number, row: number): { x: number; y: number } {
    return {
      x: col * CELL_SIZE - this.camScrollX,
      y: row * CELL_SIZE - this.camScrollY + TOOLBAR_H,
    };
  }

  private isInMapArea(sx: number, sy: number): boolean {
    const { width: W, height: H } = this.scale;
    return sx < W - PALETTE_W && sy > TOOLBAR_H && sy < H - 20;
  }

  private clampCamera() {
    const { width: W, height: H } = this.scale;
    const mapPxW = this.editorState.mapWidth  * CELL_SIZE;
    const mapPxH = this.editorState.mapHeight * CELL_SIZE;
    const viewW  = W - PALETTE_W;
    const viewH  = H - TOOLBAR_H - 20;
    this.camScrollX = Phaser.Math.Clamp(this.camScrollX, 0, Math.max(0, mapPxW - viewW));
    this.camScrollY = Phaser.Math.Clamp(this.camScrollY, 0, Math.max(0, mapPxH - viewH));
  }

  // ─── マップ再描画 ─────────────────────────

  private redrawMap() {
    this.tileGraphics.clear();
    const { mapWidth: cols, mapHeight: rows } = this.editorState;

    // 黒背景
    this.tileGraphics.fillStyle(0x0a0a1a, 1);
    this.tileGraphics.fillRect(
      -this.camScrollX, TOOLBAR_H - this.camScrollY,
      cols * CELL_SIZE, rows * CELL_SIZE
    );

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        this.drawTileGraphic(col, row);
      }
    }
    this.redrawGrid();
  }

  private redrawTileAt(col: number, row: number) {
    // 指定タイルのみ再描画（最適化）
    const { x, y } = this.tileToScreen(col, row);
    this.tileGraphics.fillStyle(0x0a0a1a, 1);
    this.tileGraphics.fillRect(x, y, CELL_SIZE, CELL_SIZE);
    this.drawTileGraphic(col, row);
  }

  private drawTileGraphic(col: number, row: number) {
    const id = this.editorState.getTile(col, row);
    if (id === 0) return;

    const { x, y } = this.tileToScreen(col, row);
    // tilesheet イメージを使って描画（スケールアップ）
    const item = PALETTE_ITEMS.find(p => p.id === id);
    const color = item?.color ?? 0x444444;

    // 背景色
    this.tileGraphics.fillStyle(color, 0.7);
    this.tileGraphics.fillRect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2);

    // ハイライト（上辺）
    this.tileGraphics.fillStyle(0xffffff, 0.15);
    this.tileGraphics.fillRect(x + 1, y + 1, CELL_SIZE - 2, 3);

    // タイルID テキスト（小）
    // （重いので省略、代わりにアイコンを別途描画）
  }

  private redrawGrid() {
    this.gridGraphics.clear();
    const { width: W, height: H } = this.scale;
    const { mapWidth: cols, mapHeight: rows } = this.editorState;

    this.gridGraphics.lineStyle(1, 0x332255, 0.4);
    for (let col = 0; col <= cols; col++) {
      const x = col * CELL_SIZE - this.camScrollX;
      if (x < 0 || x > W - PALETTE_W) continue;
      this.gridGraphics.lineBetween(x, TOOLBAR_H, x, H - 20);
    }
    for (let row = 0; row <= rows; row++) {
      const y = row * CELL_SIZE - this.camScrollY + TOOLBAR_H;
      if (y < TOOLBAR_H || y > H - 20) continue;
      this.gridGraphics.lineBetween(0, y, W - PALETTE_W, y);
    }

    // マップ境界
    this.gridGraphics.lineStyle(2, 0x8844cc, 0.8);
    this.gridGraphics.strokeRect(
      -this.camScrollX, TOOLBAR_H - this.camScrollY,
      cols * CELL_SIZE, rows * CELL_SIZE
    );
  }

  private redrawObjects() {
    this.objectGraphics.clear();
    // 既存テキストラベルを削除
    this.children.list
      .filter(c => (c as any).__isObjLabel)
      .forEach(c => c.destroy());

    for (const obj of this.editorState.objects) {
      const { x, y } = this.tileToScreen(obj.tileX, obj.tileY);
      const item = PALETTE_ITEMS.find(p => p.id === obj.type);
      if (!item) continue;

      // 半透明背景
      this.objectGraphics.fillStyle(item.color, 0.5);
      this.objectGraphics.fillRect(x + 2, y + 2, CELL_SIZE - 4, CELL_SIZE - 4);
      this.objectGraphics.lineStyle(2, item.color, 0.9);
      this.objectGraphics.strokeRect(x + 2, y + 2, CELL_SIZE - 4, CELL_SIZE - 4);

      // アイコンテキスト
      const lbl = this.add.text(x + 8, y + 8, item.icon + '\n' + item.label.slice(0,4), {
        fontSize: '8px', fontFamily: 'monospace', color: '#ffffff',
        align: 'center',
      }).setDepth(4);
      (lbl as any).__isObjLabel = true;

      // 移動床は幅を表示
      if ((obj.type === 'mover_h' || obj.type === 'mover_v') && obj.width) {
        const w = obj.width * CELL_SIZE;
        this.objectGraphics.fillStyle(item.color, 0.25);
        this.objectGraphics.fillRect(x, y + CELL_SIZE * 0.3, w, CELL_SIZE * 0.4);
        this.objectGraphics.lineStyle(1, item.color, 0.6);
        this.objectGraphics.strokeRect(x, y + CELL_SIZE * 0.3, w, CELL_SIZE * 0.4);
      }
    }
  }

  // ─── カーソル描画 ─────────────────────────

  private updateCursor(ptr: Phaser.Input.Pointer) {
    this.cursorGraphics.clear();
    if (!this.isInMapArea(ptr.x, ptr.y)) return;

    const { col, row } = this.screenToTile(ptr.x, ptr.y);
    const { x, y } = this.tileToScreen(col, row);

    if (this.toolMode === 'erase') {
      this.cursorGraphics.lineStyle(2, 0xff2222, 0.9);
    } else if (this.toolMode === 'fill') {
      this.cursorGraphics.lineStyle(2, 0x44aaff, 0.9);
    } else {
      this.cursorGraphics.lineStyle(2, 0xffee44, 0.9);
    }
    this.cursorGraphics.strokeRect(x, y, CELL_SIZE, CELL_SIZE);

    // 選択アイテムプレビュー
    if (this.toolMode === 'pen' && this.selectedItem) {
      this.cursorGraphics.fillStyle(this.selectedItem.color, 0.3);
      this.cursorGraphics.fillRect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2);
    }
  }

  private updateCoordDisplay(ptr: Phaser.Input.Pointer) {
    if (!this.isInMapArea(ptr.x, ptr.y)) { this.coordText.setText(''); return; }
    const { col, row } = this.screenToTile(ptr.x, ptr.y);
    const id = this.editorState.getTile(col, row);
    const obj = this.editorState.getObjectAt(col, row);
    this.coordText.setText(
      `(${col}, ${row}) tile:${id}${obj ? ' obj:' + obj.type : ''}`
    );
    this.statusText.setText(
      `選択: ${this.selectedItem.label} | ツール: ${this.toolMode.toUpperCase()} | ` +
      `マップ: ${this.editorState.mapWidth}×${this.editorState.mapHeight}`
    );
  }

  // ─── Undo / Redo ──────────────────────────

  private doUndo() {
    if (this.editorState.undo()) {
      this.redrawMap();
      this.redrawObjects();
      this.showToast('元に戻しました');
    } else {
      this.showToast('これ以上戻れません');
    }
  }

  private doRedo() {
    if (this.editorState.redo()) {
      this.redrawMap();
      this.redrawObjects();
      this.showToast('やり直しました');
    } else {
      this.showToast('やり直す操作がありません');
    }
  }

  // ─── セーブ ───────────────────────────────

  private saveLevel() {
    const id = this.editorState.saveToStorage(this.currentLevelId ?? undefined);
    this.currentLevelId = id;
    this.showToast(`保存しました: ${this.editorState.name}`);
    this.levelNameText.setText(`▶ ${this.editorState.name}`);
  }

  // ─── ロードパネル ─────────────────────────

  private openLoadPanel() {
    this.closePanels();
    const { width: W, height: H } = this.scale;
    const PW = 320, PH = 340;
    const px = (W - PALETTE_W - PW) / 2;
    const py = TOOLBAR_H + (H - TOOLBAR_H - PH) / 2;

    const container = this.add.container(px, py).setDepth(200);
    this.saveListContainer = container;

    const bg = this.add.graphics();
    bg.fillStyle(0x1a1535, 0.97);
    bg.fillRoundedRect(0, 0, PW, PH, 8);
    bg.lineStyle(1, 0x8844cc, 1);
    bg.strokeRoundedRect(0, 0, PW, PH, 8);
    container.add(bg);

    container.add(this.add.text(12, 10, '📂 保存済みコース', {
      fontSize: '14px', fontFamily: 'monospace', color: '#ccaaff',
    }));

    const levels = this.editorState.loadAllFromStorage();
    if (levels.length === 0) {
      container.add(this.add.text(12, 50, '保存済みのコースがありません', {
        fontSize: '11px', fontFamily: 'monospace', color: '#776699',
      }));
    } else {
      levels.forEach((lvl, i) => {
        const itemY = 46 + i * 40;
        const date = new Date(lvl.createdAt).toLocaleDateString('ja-JP');

        const loadBtn = this.add.text(12, itemY, `▶ ${lvl.name}`, {
          fontSize: '12px', fontFamily: 'monospace', color: '#aaaadd',
          backgroundColor: '#251d45', padding: { x: 8, y: 4 },
        }).setInteractive({ cursor: 'pointer' });
        loadBtn.on('pointerdown', () => {
          this.editorState.loadFromStorage(lvl.id);
          this.currentLevelId = lvl.id;
          this.levelNameText.setText(`▶ ${this.editorState.name}`);
          this.redrawMap(); this.redrawObjects();
          this.closePanels();
          this.showToast(`ロード: ${lvl.name}`);
        });
        loadBtn.on('pointerover', () => loadBtn.setStyle({ color: '#ffffff' }));
        loadBtn.on('pointerout',  () => loadBtn.setStyle({ color: '#aaaadd' }));

        const delBtn = this.add.text(PW - 40, itemY, '✕', {
          fontSize: '12px', fontFamily: 'monospace', color: '#884444',
          backgroundColor: '#2a1530', padding: { x: 4, y: 4 },
        }).setInteractive({ cursor: 'pointer' });
        delBtn.on('pointerdown', () => {
          import('../systems/LevelEditorState').then(m => {
            m.LevelEditorState.deleteFromStorage(lvl.id);
            this.closePanels();
            this.openLoadPanel();
          });
        });

        container.add(this.add.text(12, itemY + 18, `  作成: ${date}  タイル: ${lvl.snapshot.mapWidth}×${lvl.snapshot.mapHeight}`, {
          fontSize: '9px', fontFamily: 'monospace', color: '#554466',
        }));
        container.add(loadBtn);
        container.add(delBtn);
      });
    }

    // 新規ボタン
    const newBtn = this.add.text(12, PH - 36, '＋ 新規コース', {
      fontSize: '12px', fontFamily: 'monospace', color: '#44cc88',
      backgroundColor: '#0a2a18', padding: { x: 8, y: 4 },
    }).setInteractive({ cursor: 'pointer' });
    newBtn.on('pointerdown', () => {
      this.editorState = new LevelEditorState(60, 30);
      this.currentLevelId = null;
      this.levelNameText.setText(`▶ ${this.editorState.name}`);
      this.redrawMap(); this.redrawObjects();
      this.closePanels();
      this.showToast('新規コースを作成しました');
    });

    const closeBtn = this.add.text(PW - 36, 10, '✕', {
      fontSize: '14px', fontFamily: 'monospace', color: '#884444',
    }).setInteractive({ cursor: 'pointer' });
    closeBtn.on('pointerdown', () => this.closePanels());

    container.add([newBtn, closeBtn]);
    this.cameras.main.ignore(container);
  }

  // ─── 設定パネル ───────────────────────────

  private openSettings() {
    this.closePanels();
    const { width: W, height: H } = this.scale;
    const PW = 300, PH = 280;
    const px = (W - PALETTE_W - PW) / 2;
    const py = TOOLBAR_H + 40;

    const container = this.add.container(px, py).setDepth(200);
    this.settingsContainer = container;

    const bg = this.add.graphics();
    bg.fillStyle(0x1a1535, 0.97);
    bg.fillRoundedRect(0, 0, PW, PH, 8);
    bg.lineStyle(1, 0x8844cc, 1);
    bg.strokeRoundedRect(0, 0, PW, PH, 8);
    container.add(bg);
    container.add(this.add.text(12, 10, '⚙ コース設定', {
      fontSize: '14px', fontFamily: 'monospace', color: '#ccaaff',
    }));

    const es = this.editorState;

    // マップサイズ
    container.add(this.add.text(12, 46, `マップサイズ: ${es.mapWidth}×${es.mapHeight}`, {
      fontSize: '11px', fontFamily: 'monospace', color: '#aaaacc',
    }));
    const sizeOptions = [
      { label: '小  40×20', w: 40, h: 20 },
      { label: '中  60×30', w: 60, h: 30 },
      { label: '大  100×30',w: 100,h: 30 },
      { label: '縦  40×50', w: 40, h: 50 },
    ];
    sizeOptions.forEach((opt, i) => {
      const btn = this.add.text(12 + i * 68, 66, opt.label, {
        fontSize: '9px', fontFamily: 'monospace', color: '#aaaadd',
        backgroundColor: '#252045', padding: { x: 4, y: 3 },
      }).setInteractive({ cursor: 'pointer' });
      btn.on('pointerdown', () => {
        es.snapshot();
        es.resize(opt.w, opt.h);
        this.camScrollX = 0; this.camScrollY = 0;
        this.redrawMap(); this.redrawObjects();
        this.closePanels(); this.openSettings();
      });
      container.add(btn);
    });

    // 重力
    container.add(this.add.text(12, 104, `重力: ${es.gravity}`, {
      fontSize: '11px', fontFamily: 'monospace', color: '#aaaacc',
    }));
    [600, 900, 1200, 1800].forEach((g, i) => {
      const btn = this.add.text(12 + i * 66, 122, `${g}`, {
        fontSize: '10px', fontFamily: 'monospace',
        color: es.gravity === g ? '#ffee44' : '#aaaadd',
        backgroundColor: es.gravity === g ? '#3a2a70' : '#252045',
        padding: { x: 6, y: 3 },
      }).setInteractive({ cursor: 'pointer' });
      btn.on('pointerdown', () => { es.gravity = g; this.closePanels(); this.openSettings(); });
      container.add(btn);
    });

    // 背景色
    container.add(this.add.text(12, 158, '背景テーマ:', {
      fontSize: '11px', fontFamily: 'monospace', color: '#aaaacc',
    }));
    const themes = [
      { label: '夜の学校', color: 0x0a0a1a },
      { label: '地下室',   color: 0x06060f },
      { label: '屋上',     color: 0x050008 },
      { label: '夕暮れ',   color: 0x1a0808 },
    ];
    themes.forEach((t, i) => {
      const btn = this.add.text(12 + (i % 2) * 130, 176 + Math.floor(i / 2) * 22, t.label, {
        fontSize: '10px', fontFamily: 'monospace',
        color: es.bgColor === t.color ? '#ffee44' : '#aaaadd',
        backgroundColor: `#${t.color.toString(16).padStart(6,'0')}`,
        padding: { x: 6, y: 3 },
      }).setInteractive({ cursor: 'pointer' });
      btn.on('pointerdown', () => { es.bgColor = t.color; this.closePanels(); this.openSettings(); });
      container.add(btn);
    });

    const closeBtn = this.add.text(PW - 32, 10, '✕', {
      fontSize: '14px', fontFamily: 'monospace', color: '#884444',
    }).setInteractive({ cursor: 'pointer' });
    closeBtn.on('pointerdown', () => this.closePanels());
    container.add(closeBtn);

    this.cameras.main.ignore(container);
  }

  // ─── オブジェクトプロパティ編集 ─────────────

  private openObjectProperties(obj: EditorObject) {
    this.propPanel?.destroy();
    const { width: W, height: H } = this.scale;
    const PW = 240, PH = 160;
    const { x: ox, y: oy } = this.tileToScreen(obj.tileX, obj.tileY);

    const container = this.add.container(
      Math.min(ox + CELL_SIZE + 4, W - PALETTE_W - PW),
      Math.min(oy, H - PH - 20)
    ).setDepth(200);
    this.propPanel = container;

    const bg = this.add.graphics();
    bg.fillStyle(0x1a1535, 0.97);
    bg.fillRoundedRect(0, 0, PW, PH, 6);
    bg.lineStyle(1, 0xaa8855, 0.8);
    bg.strokeRoundedRect(0, 0, PW, PH, 6);
    container.add(bg);

    const item = PALETTE_ITEMS.find(p => p.id === obj.type);
    container.add(this.add.text(8, 8, `${item?.icon} ${item?.label} プロパティ`, {
      fontSize: '11px', fontFamily: 'monospace', color: '#ccaaff',
    }));

    if (obj.type === 'mover_h' || obj.type === 'mover_v') {
      const propDefs = [
        { label: '幅（タイル）', key: 'width',  min: 2,  max: 12, step: 1, val: obj.width  ?? 4  },
        { label: '範囲（タイル）',key: 'range',  min: 2,  max: 20, step: 1, val: obj.range  ?? 6  },
        { label: '速度（px/s）', key: 'speed',  min: 20, max: 200,step: 10,val: obj.speed  ?? 60 },
      ];
      propDefs.forEach((prop, i) => {
        const y = 34 + i * 36;
        container.add(this.add.text(8, y, `${prop.label}: ${prop.val}`, {
          fontSize: '10px', fontFamily: 'monospace', color: '#aaaacc',
        }));
        const dec = this.add.text(8, y + 14, '◀', {
          fontSize: '11px', fontFamily: 'monospace', color: '#aaaadd',
          backgroundColor: '#252045', padding: { x: 5, y: 2 },
        }).setInteractive({ cursor: 'pointer' });
        const inc = this.add.text(28, y + 14, '▶', {
          fontSize: '11px', fontFamily: 'monospace', color: '#aaaadd',
          backgroundColor: '#252045', padding: { x: 5, y: 2 },
        }).setInteractive({ cursor: 'pointer' });
        dec.on('pointerdown', () => {
          (obj as any)[prop.key] = Math.max(prop.min, ((obj as any)[prop.key] ?? prop.val) - prop.step);
          this.openObjectProperties(obj); this.redrawObjects();
        });
        inc.on('pointerdown', () => {
          (obj as any)[prop.key] = Math.min(prop.max, ((obj as any)[prop.key] ?? prop.val) + prop.step);
          this.openObjectProperties(obj); this.redrawObjects();
        });
        container.add([dec, inc]);
      });
    }

    const delBtn = this.add.text(8, PH - 26, '🗑 削除', {
      fontSize: '10px', fontFamily: 'monospace', color: '#ff4444',
      backgroundColor: '#2a1010', padding: { x: 6, y: 3 },
    }).setInteractive({ cursor: 'pointer' });
    delBtn.on('pointerdown', () => {
      this.editorState.snapshot();
      this.editorState.removeObjectAt(obj.tileX, obj.tileY);
      this.redrawObjects();
      this.propPanel?.destroy();
      this.propPanel = null;
    });

    const closeBtn = this.add.text(PW - 24, 6, '✕', {
      fontSize: '12px', fontFamily: 'monospace', color: '#884444',
    }).setInteractive({ cursor: 'pointer' });
    closeBtn.on('pointerdown', () => { this.propPanel?.destroy(); this.propPanel = null; });

    container.add([delBtn, closeBtn]);
    this.cameras.main.ignore(container);
  }

  // ─── 名前編集 ─────────────────────────────

  private openNameEditor() {
    const input = document.createElement('input');
    input.type  = 'text';
    input.value = this.editorState.name;
    input.maxLength = 20;
    Object.assign(input.style, {
      position: 'fixed', top: '30px', left: '8px',
      width: '160px', padding: '2px 6px',
      background: '#1a1540', color: '#ccaaff',
      border: '1px solid #8844cc', borderRadius: '4px',
      fontFamily: 'monospace', fontSize: '12px',
      outline: 'none', zIndex: '9999',
    });
    document.body.appendChild(input);
    input.focus(); input.select();
    const commit = () => {
      this.editorState.name = input.value.trim() || 'マイコース';
      this.levelNameText.setText(`▶ ${this.editorState.name}`);
      document.body.removeChild(input);
    };
    input.addEventListener('blur',  commit);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); });
  }

  // ─── プレイテスト ─────────────────────────

  private startPlayTest() {
    // エディタの状態を LevelDef に変換してゲームシーンで起動
    const def = this.editorState.toLevelDef();
    // GameSceneに渡すためグローバル一時保存
    (window as any).__editorTestLevel = def;
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.time.delayedCall(300, () => {
      this.scene.stop('EditorScene');
      this.scene.start('GameScene', { customLevel: def, returnToEditor: true });
    });
  }

  // ─── タイトルへ ───────────────────────────

  private goToTitle() {
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.time.delayedCall(300, () => {
      this.scene.stop('EditorScene');
      this.scene.start('TitleScene');
    });
  }

  // ─── パネルを閉じる ─────────────────────

  private closePanels() {
    this.saveListContainer?.destroy();
    this.saveListContainer = null;
    this.settingsContainer?.destroy();
    this.settingsContainer = null;
    this.propPanel?.destroy();
    this.propPanel = null;
    this.hideTooltip();
  }

  // ─── ツールチップ ─────────────────────────

  private tooltip: Phaser.GameObjects.Container | null = null;

  private showItemTooltip(x: number, y: number, item: PaletteItem) {
    this.hideTooltip();
    const { width: W, height: H } = this.scale;
    const lines = item.description.split('\n');
    const maxW = 160;

    const container = this.add.container(
      Math.min(x, W - PALETTE_W - maxW - 10),
      Math.min(y, H - 60)
    ).setDepth(300);
    this.tooltip = container;

    const bg = this.add.graphics();
    bg.fillStyle(0x0e0c20, 0.96);
    bg.fillRoundedRect(0, 0, maxW, 16 + lines.length * 14, 4);
    bg.lineStyle(1, `0x${item.color.toString(16).padStart(6,'0')}` as any, 0.8);
    bg.strokeRoundedRect(0, 0, maxW, 16 + lines.length * 14, 4);
    container.add(bg);

    container.add(this.add.text(8, 4, item.label, {
      fontSize: '11px', fontFamily: 'monospace', color: `#${item.color.toString(16).padStart(6,'0')}`,
    }));
    lines.forEach((line, i) => {
      container.add(this.add.text(8, 18 + i * 14, line, {
        fontSize: '9px', fontFamily: 'monospace', color: '#9988bb',
      }));
    });

    this.cameras.main.ignore(container);
  }

  private hideTooltip() {
    this.tooltip?.destroy();
    this.tooltip = null;
  }

  // ─── トースト通知 ─────────────────────────

  private showToast(msg: string, duration = 1500) {
    const existing = this.children.getByName('toast') as Phaser.GameObjects.Text | null;
    existing?.destroy();

    const { width: W, height: H } = this.scale;
    const toast = this.add.text(W / 2 - PALETTE_W / 2, H - 50, msg, {
      fontSize: '11px', fontFamily: 'monospace', color: '#ffee88',
      backgroundColor: '#1a0e35',
      padding: { x: 12, y: 6 },
      align: 'center',
    }).setOrigin(0.5).setDepth(300).setName('toast').setAlpha(0);

    this.tweens.add({ targets: toast, alpha: 1, duration: 200 });
    this.time.delayedCall(duration, () => {
      this.tweens.add({ targets: toast, alpha: 0, duration: 300, onComplete: () => toast.destroy() });
    });
    this.cameras.main.ignore(toast);
  }

  // ─── UPDATE ───────────────────────────────

  update() {
    // カメラスクロール反映
    this.cameras.main.setScroll(this.camScrollX, this.camScrollY - TOOLBAR_H);

    // オブジェクトラベルの位置更新（スクロール追従）
    this.children.list
      .filter(c => (c as any).__isObjLabel)
      .forEach(c => {
        // ラベルはredrawObjects()で毎回再生成するので位置更新は不要
      });
  }
}
