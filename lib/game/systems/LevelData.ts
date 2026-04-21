/**
 * LevelData.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * 久条高校 全レベルデータ
 *
 * タイル凡例:
 *  0 = 空     1 = 床     2 = 壁     3 = 天井
 *  4 = 片側PF  5 = 梯子   6 = 梯子トップ  7 = 落下穴
 *  8 = 棘     9 = ワープ  10= ロッカー   11= 窓
 * 12= 黒板   13= 移動床H  14= 移動床V   15= 破壊床
 * 16= バネ
 *
 * マップ座標：タイル単位 (16px × 16px/tile)
 * レベル1 = 1F廊下     (100列×32行)
 * レベル2 = 屋上階段    (60列×48行) ← 垂直移動メイン
 * レベル3 = ボスアリーナ (60列×32行)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { LevelDef, TileID as T } from '../systems/TileSystem';
const _ = T.EMPTY;
const F = T.FLOOR;
const W = T.WALL;
const C = T.CEILING;
const P = T.PLATFORM;
const L = T.LADDER;
const G = T.LADDER_TOP;  // Ladder Top
const H = T.PIT;
const S = T.SPIKE;
const X = T.WARP;
const O = T.LOCKER;
const V = T.WINDOW;
const B = T.BOARD;
const MH= T.MOVER_H;
const MV= T.MOVER_V;
const BK= T.BREAKABLE;
const SP= T.SPRING;

// ─────────────────────────────────────────────────────────────────────
// LEVEL 1 — 1F廊下・校舎エントランス
//   横スクロール中心。途中で梯子エリア・ピット・移動床が登場
//   サイズ: 100列×30行 = 1600×480 px
// ─────────────────────────────────────────────────────────────────────

function makeRow(cols: number, fill: number): number[] {
  return Array(cols).fill(fill);
}
function emptyRow(cols: number): number[] {
  return makeRow(cols, _);
}

// 100列幅の行を手動で書くのは非実用的なのでヘルパー関数で構築
function buildRow(cols: number, segments: Array<[number, number]>): number[] {
  const row = Array(cols).fill(_);
  for (const [startCol, id] of segments) {
    if (startCol < 0 || startCol >= cols) continue;
    row[startCol] = id;
  }
  return row;
}

// 連続セグメントを埋める: [col, length, id]
function fillRow(cols: number, fills: Array<[number, number, number]>, base = _): number[] {
  const row = Array(cols).fill(base);
  for (const [col, len, id] of fills) {
    for (let i = 0; i < len && col + i < cols; i++) row[col + i] = id;
  }
  return row;
}

const COLS_L1 = 100;
const ROWS_L1 = 30;

function buildLevel1Data(): number[][] {
  const rows: number[][] = [];

  //  0: 天井行
  rows.push(fillRow(COLS_L1, [[0, COLS_L1, C]]));

  //  1: 天井装飾行（窓）
  rows.push(fillRow(COLS_L1, [[0,1,C],[1,4,V],[5,1,C],[8,4,V],[13,1,C],[16,4,V],[21,1,C],[26,4,V],[31,1,C],[34,4,V],[39,1,C],[44,4,V],[49,1,C],[54,4,V],[59,1,C],[64,4,V],[69,1,C],[74,4,V],[79,1,C],[84,4,V],[89,1,C],[94,4,V],[99,1,C]]));

  //  2-4: 上部空間
  rows.push(emptyRow(COLS_L1));
  rows.push(emptyRow(COLS_L1));
  rows.push(emptyRow(COLS_L1));

  //  5: 高い場所プラットフォーム（段階的階段）
  rows.push(fillRow(COLS_L1, [[10,5,P],[22,5,P],[34,5,P],[46,5,P],[60,4,P],[72,4,P],[82,6,P]]));

  //  6: 空
  rows.push(fillRow(COLS_L1, [[10,5,G],[22,5,G],[34,5,G],[46,5,G]]));  // 梯子トップ

  //  7-9: 空中エリア（梯子で連結）
  rows.push(fillRow(COLS_L1, [[10,1,L],[14,1,L],[22,1,L],[26,1,L],[34,1,L],[38,1,L],[46,1,L],[50,1,L]]));
  rows.push(fillRow(COLS_L1, [[10,1,L],[14,1,L],[22,1,L],[26,1,L],[34,1,L],[38,1,L],[46,1,L],[50,1,L]]));
  rows.push(fillRow(COLS_L1, [[10,1,L],[14,1,L],[22,1,L],[26,1,L],[34,1,L],[38,1,L],[46,1,L],[50,1,L]]));

  // 10: 中段プラットフォーム + 梯子トップ
  rows.push(fillRow(COLS_L1, [[6,6,P],[10,1,G],[14,1,G],[18,6,P],[22,1,G],[26,1,G],[30,6,P],[34,1,G],[38,1,G],[42,6,P],[46,1,G],[50,1,G],[56,6,BK],[68,5,P],[78,5,MH],[88,5,P]]));

  // 11: 梯子継続
  rows.push(fillRow(COLS_L1, [[10,1,L],[14,1,L],[22,1,L],[26,1,L],[34,1,L],[38,1,L],[46,1,L],[50,1,L]]));

  // 12: 梯子継続 + バネ
  rows.push(fillRow(COLS_L1, [[10,1,L],[14,1,L],[22,1,L],[26,1,L],[34,1,L],[38,1,L],[46,1,L],[50,1,L],[62,1,SP]]));

  // 13: 低い中段プラットフォーム + 梯子トップ
  rows.push(fillRow(COLS_L1, [[8,4,G],[10,1,G],[12,4,P],[14,1,G],[20,4,G],[22,1,G],[24,4,P],[26,1,G],[32,4,G],[34,1,G],[36,4,P],[38,1,G],[44,4,G],[46,1,G],[48,4,P],[50,1,G],[55,4,P],[65,4,P],[75,5,P]]));

  // 14: 梯子（床まで続く）
  rows.push(fillRow(COLS_L1, [[10,1,L],[14,1,L],[22,1,L],[26,1,L],[34,1,L],[38,1,L],[46,1,L],[50,1,L]]));

  // 15: 棘トラップ + 梯子
  rows.push(fillRow(COLS_L1, [[0,1,W],[10,1,L],[14,1,L],[22,1,L],[26,1,L],[28,3,S],[34,1,L],[38,1,L],[46,1,L],[50,1,L],[52,2,S],[99,1,W]]));

  // 16: ピット手前
  rows.push(fillRow(COLS_L1, [[0,1,W],[10,1,L],[14,1,L],[22,1,L],[26,1,L],[34,1,L],[38,1,L],[46,1,L],[50,1,L],[99,1,W]]));

  // 17: 床 + ピット + ロッカー
  rows.push(fillRow(COLS_L1, [[0,1,W],[1,8,F],[9,4,H],[13,1,F],[14,1,G],[15,5,F],[20,1,F],[21,1,F],[22,1,G],[23,3,F],[26,1,G],[27,3,F],[30,4,O],[34,1,G],[35,3,F],[38,1,G],[39,3,F],[42,2,F],[44,4,H],[48,4,F],[50,1,G],[51,3,F],[54,6,F],[60,1,F],[61,4,H],[65,5,F],[70,1,F],[71,4,H],[75,10,F],[85,4,H],[89,11,F],[99,1,W]]));

  // 18: 床（メイン地面）
  rows.push(fillRow(COLS_L1, [[0,1,W],[1,COLS_L1-2,F],[99,1,W]]));

  // 19: 地面
  rows.push(fillRow(COLS_L1, [[0,COLS_L1,F]]));

  // 20: 地面下（壁）
  rows.push(fillRow(COLS_L1, [[0,COLS_L1,W]]));

  // 21-22: 地下（2Fへの梯子）
  rows.push(fillRow(COLS_L1, [[0,1,W],[1,COLS_L1-2,_],[18,1,L],[36,1,L],[54,1,L],[72,1,L],[99,1,W]]));
  rows.push(fillRow(COLS_L1, [[0,1,W],[18,1,L],[36,1,L],[54,1,L],[72,1,L],[99,1,W]]));

  // 23: 地下ルーム（隠し通路）
  rows.push(fillRow(COLS_L1, [[0,1,W],[18,1,L],[36,1,L],[54,1,L],[72,1,L],[99,1,W]]));

  // 24: 地下通路
  rows.push(fillRow(COLS_L1, [[0,1,W],[1,17,_],[18,1,G],[19,17,_],[36,1,G],[37,17,_],[54,1,G],[55,17,_],[72,1,G],[73,27,_],[99,1,W]]));

  // 25: 地下出口（ワープ）
  rows.push(fillRow(COLS_L1, [[0,1,W],[1,17,_],[18,1,_],[19,17,_],[36,1,_],[37,17,_],[54,1,_],[55,17,_],[72,1,_],[73,3,_],[76,1,X],[77,22,_],[99,1,W]]));

  // 26-27: 地下床
  rows.push(fillRow(COLS_L1, [[0,COLS_L1,F]]));
  rows.push(fillRow(COLS_L1, [[0,COLS_L1,W]]));

  // 足りない行をゼロ埋め
  while (rows.length < ROWS_L1) rows.push(emptyRow(COLS_L1));

  return rows.slice(0, ROWS_L1);
}

// ─────────────────────────────────────────────────────────────────────
// LEVEL 2 — 縦方向移動ステージ（校舎内部：1F〜4F）
//   主に垂直移動。梯子・移動床・破壊ブロック多用
//   サイズ: 60列×60行 = 960×960 px
// ─────────────────────────────────────────────────────────────────────

const COLS_L2 = 60;
const ROWS_L2 = 60;

function buildLevel2Data(): number[][] {
  const rows: number[][] = [];

  // 0: 天井
  rows.push(fillRow(COLS_L2, [[0,COLS_L2,C]]));

  // 1-2: 最上階（屋上アクセス）
  rows.push(fillRow(COLS_L2, [[0,1,W],[1,58,_],[59,1,W]]));
  rows.push(fillRow(COLS_L2, [[0,1,W],[28,1,G],[31,1,G],[59,1,W]]));

  // 3-5: 上部空間
  for (let i = 0; i < 3; i++)
    rows.push(fillRow(COLS_L2, [[0,1,W],[28,1,L],[31,1,L],[59,1,W]]));

  // 6: 4F プラットフォーム
  rows.push(fillRow(COLS_L2, [[0,1,W],[5,10,P],[20,8,P],[28,1,G],[31,1,G],[33,10,P],[45,8,P],[59,1,W]]));

  // 7-9: 4F内部
  for (let i = 0; i < 3; i++)
    rows.push(fillRow(COLS_L2, [[0,1,W],[8,1,L],[28,1,L],[31,1,L],[52,1,L],[59,1,W]]));

  // 10: 4F天井/床
  rows.push(fillRow(COLS_L2, [[0,1,W],[1,6,F],[7,2,_],[9,12,F],[21,6,_],[27,1,G],[28,1,G],[29,1,F],[30,2,_],[31,1,G],[32,4,F],[36,6,_],[42,11,F],[53,1,G],[54,6,F],[59,1,W]]));

  // 11-12: 4F→3F梯子
  for (let i = 0; i < 2; i++)
    rows.push(fillRow(COLS_L2, [[0,1,W],[8,1,L],[28,1,L],[31,1,L],[52,1,L],[59,1,W]]));

  // 13: 移動床登場
  rows.push(fillRow(COLS_L2, [[0,1,W],[5,4,MH],[22,4,MV],[40,4,MH],[59,1,W]]));

  // 14-16: 3F空間
  for (let i = 0; i < 3; i++)
    rows.push(fillRow(COLS_L2, [[0,1,W],[8,1,L],[28,1,L],[31,1,L],[52,1,L],[59,1,W]]));

  // 17: 3F床 + ロッカー + 窓
  rows.push(fillRow(COLS_L2, [[0,1,W],[1,5,F],[6,3,O],[9,12,F],[21,4,V],[25,2,F],[27,1,G],[28,1,G],[29,3,F],[32,4,V],[36,2,F],[38,3,O],[41,11,F],[52,1,G],[53,6,F],[59,1,W]]));

  // 18-20: 3F内部（棘トラップ）
  rows.push(fillRow(COLS_L2, [[0,1,W],[8,1,L],[28,1,L],[31,1,L],[52,1,L],[59,1,W]]));
  rows.push(fillRow(COLS_L2, [[0,1,W],[8,1,L],[15,3,S],[28,1,L],[31,1,L],[43,3,S],[52,1,L],[59,1,W]]));
  rows.push(fillRow(COLS_L2, [[0,1,W],[8,1,L],[28,1,L],[31,1,L],[52,1,L],[59,1,W]]));

  // 21: 破壊可能ブロック列
  rows.push(fillRow(COLS_L2, [[0,1,W],[5,3,BK],[10,3,BK],[20,3,BK],[30,3,BK],[40,3,BK],[50,3,BK],[59,1,W]]));

  // 22-23: 2F→3F中間
  for (let i = 0; i < 2; i++)
    rows.push(fillRow(COLS_L2, [[0,1,W],[8,1,L],[28,1,L],[31,1,L],[52,1,L],[59,1,W]]));

  // 24: 2F床（黒板・ロッカー）
  rows.push(fillRow(COLS_L2, [[0,1,W],[1,7,F],[8,1,G],[9,2,B],[11,10,F],[21,4,V],[25,2,F],[27,1,G],[28,1,G],[29,4,F],[33,4,V],[37,2,F],[39,3,O],[42,9,F],[51,1,G],[52,1,G],[53,5,F],[59,1,W]]));

  // 25-26: 2F空間（左右移動床）
  rows.push(fillRow(COLS_L2, [[0,1,W],[8,1,L],[28,1,L],[31,1,L],[52,1,L],[59,1,W]]));
  rows.push(fillRow(COLS_L2, [[0,1,W],[10,4,MH],[30,4,MV],[46,4,MH],[59,1,W]]));

  // 27-29: 2F
  for (let i = 0; i < 3; i++)
    rows.push(fillRow(COLS_L2, [[0,1,W],[8,1,L],[28,1,L],[31,1,L],[52,1,L],[59,1,W]]));

  // 30: バネ床 + 棘
  rows.push(fillRow(COLS_L2, [[0,1,W],[5,1,SP],[20,1,SP],[35,1,SP],[50,1,SP],[16,2,S],[32,2,S],[48,2,S],[59,1,W]]));

  // 31: 2F→1F
  for (let i = 0; i < 2; i++)
    rows.push(fillRow(COLS_L2, [[0,1,W],[8,1,L],[28,1,L],[31,1,L],[52,1,L],[59,1,W]]));

  // 33: ピット地帯（危険ゾーン）
  rows.push(fillRow(COLS_L2, [[0,1,W],[1,4,F],[5,4,H],[9,6,F],[15,4,H],[19,6,F],[25,4,H],[29,2,F],[31,2,F],[33,4,H],[37,6,F],[43,4,H],[47,6,F],[53,4,H],[57,2,F],[59,1,W]]));

  // 34-35: 1F内部（梯子継続）
  for (let i = 0; i < 2; i++)
    rows.push(fillRow(COLS_L2, [[0,1,W],[8,1,L],[28,1,L],[31,1,L],[52,1,L],[59,1,W]]));

  // 36: 1F床（ワープ出口）
  rows.push(fillRow(COLS_L2, [[0,1,W],[1,7,F],[8,1,G],[9,12,F],[21,4,F],[25,2,F],[27,1,G],[28,1,G],[29,4,F],[33,4,F],[37,2,F],[39,3,F],[42,9,F],[51,1,G],[52,1,G],[53,4,F],[57,1,X],[58,1,F],[59,1,W]]));

  // 37-38: 1F（梯子）
  for (let i = 0; i < 2; i++)
    rows.push(fillRow(COLS_L2, [[0,1,W],[8,1,L],[28,1,L],[31,1,L],[52,1,L],[59,1,W]]));

  // 39: 床
  rows.push(fillRow(COLS_L2, [[0,COLS_L2,F]]));

  // 40: 地下ルーム（B1F）開始
  rows.push(fillRow(COLS_L2, [[0,1,W],[8,1,G],[28,1,G],[31,1,G],[52,1,G],[59,1,W]]));

  // 41-43: B1F空間
  for (let i = 0; i < 3; i++)
    rows.push(fillRow(COLS_L2, [[0,1,W],[8,1,L],[28,1,L],[31,1,L],[52,1,L],[59,1,W]]));

  // 44: B1F床 + ショートカットワープ
  rows.push(fillRow(COLS_L2, [[0,1,W],[1,4,F],[5,1,X],[6,16,F],[22,4,H],[26,4,F],[30,4,H],[34,4,F],[38,4,H],[42,15,F],[57,1,X],[58,1,F],[59,1,W]]));

  // 45-58: さらに地下
  for (let i = 0; i < 14; i++)
    rows.push(fillRow(COLS_L2, [[0,1,W],[59,1,W]]));

  // 59: 地下底
  rows.push(fillRow(COLS_L2, [[0,COLS_L2,W]]));

  while (rows.length < ROWS_L2) rows.push(emptyRow(COLS_L2));
  return rows.slice(0, ROWS_L2);
}

// ─────────────────────────────────────────────────────────────────────
// LEVEL 3 — ボスアリーナ（屋上）
//   広い開けた屋上。段差・移動床・棘。ボス専用ステージ
//   サイズ: 80列×30行 = 1280×480 px
// ─────────────────────────────────────────────────────────────────────

const COLS_L3 = 80;
const ROWS_L3 = 30;

function buildLevel3Data(): number[][] {
  const rows: number[][] = [];

  // 0-1: 上空
  rows.push(emptyRow(COLS_L3));
  rows.push(fillRow(COLS_L3, [[0,1,W],[79,1,W]]));

  // 2-4: 高台プラットフォーム（ボスが使う）
  rows.push(fillRow(COLS_L3, [[0,1,W],[10,8,P],[35,10,P],[61,8,P],[79,1,W]]));
  rows.push(fillRow(COLS_L3, [[0,1,W],[79,1,W]]));
  rows.push(fillRow(COLS_L3, [[0,1,W],[79,1,W]]));

  // 5: 移動床
  rows.push(fillRow(COLS_L3, [[0,1,W],[20,4,MH],[40,4,MV],[56,4,MH],[79,1,W]]));

  // 6-9: 中間空間
  for (let i = 0; i < 4; i++)
    rows.push(fillRow(COLS_L3, [[0,1,W],[79,1,W]]));

  // 10: 中段プラットフォーム（棘あり）
  rows.push(fillRow(COLS_L3, [[0,1,W],[5,6,P],[13,2,S],[15,4,P],[21,2,S],[23,4,P],[30,4,P],[37,2,S],[39,4,P],[46,2,S],[48,4,P],[56,4,P],[64,2,S],[66,6,P],[79,1,W]]));

  // 11-13: 中段空間
  for (let i = 0; i < 3; i++)
    rows.push(fillRow(COLS_L3, [[0,1,W],[79,1,W]]));

  // 14: バネ床
  rows.push(fillRow(COLS_L3, [[0,1,W],[15,1,SP],[30,1,SP],[45,1,SP],[60,1,SP],[79,1,W]]));

  // 15-18: 低段空間
  for (let i = 0; i < 4; i++)
    rows.push(fillRow(COLS_L3, [[0,1,W],[79,1,W]]));

  // 19: 屋上メイン床（ピット×2）
  rows.push(fillRow(COLS_L3, [[0,1,W],[1,10,F],[11,3,H],[14,10,F],[24,3,H],[27,6,F],[33,5,F],[38,4,H],[42,10,F],[52,3,H],[55,8,F],[63,4,H],[67,12,F],[79,1,W]]));

  // 20: 床（ソリッド）
  rows.push(fillRow(COLS_L3, [[0,COLS_L3,F]]));

  // 21: 地下
  rows.push(fillRow(COLS_L3, [[0,COLS_L3,W]]));

  // 22-25: ドレイン（ボス逃げ場なし）
  for (let i = 0; i < 4; i++)
    rows.push(fillRow(COLS_L3, [[0,1,W],[79,1,W]]));

  // 26: ワープアウト（クリア後）
  rows.push(fillRow(COLS_L3, [[0,1,W],[38,1,X],[41,1,X],[79,1,W]]));

  // 27-29
  for (let i = 0; i < 3; i++)
    rows.push(fillRow(COLS_L3, [[0,COLS_L3,W]]));

  while (rows.length < ROWS_L3) rows.push(emptyRow(COLS_L3));
  return rows.slice(0, ROWS_L3);
}

// ─────────────────────────────────────────────────────────────────────
// レベル定義エクスポート
// ─────────────────────────────────────────────────────────────────────

export const LEVEL_1_DEF: LevelDef = {
  name: '1F廊下',
  mapWidth:  COLS_L1,
  mapHeight: ROWS_L1,
  bgColor:   0x0a0a1a,
  gravity:   900,
  playerStart: { x: 3, y: 17 },
  layers: [
    { name: 'main', data: buildLevel1Data() },
  ],
  movingPlatforms: [
    { tileX: 78, tileY: 10, width: 5, axis: 'h', range: 6, speed: 60 },
  ],
  warps: [
    { fromX: 76, fromY: 25, toX: 3, toY: 17, label: '隠し通路出口（ループ）' },
  ],
  enemies: [
    { tileX: 20, tileY: 17, type: 'thug' },
    { tileX: 30, tileY: 17, type: 'thug' },
    { tileX: 45, tileY: 17, type: 'thug_red', triggerTileX: 35 },
    { tileX: 55, tileY: 17, type: 'thug',     triggerTileX: 35 },
    { tileX: 65, tileY: 17, type: 'thug_red', triggerTileX: 55 },
    { tileX: 75, tileY: 17, type: 'thug',     triggerTileX: 55 },
    { tileX: 85, tileY: 17, type: 'thug',     triggerTileX: 75 },
    { tileX: 90, tileY: 17, type: 'thug_red', triggerTileX: 75 },
    { tileX: 95, tileY: 17, type: 'boss',     triggerTileX: 88 },
  ],
};

export const LEVEL_2_DEF: LevelDef = {
  name: '校舎内部',
  mapWidth:  COLS_L2,
  mapHeight: ROWS_L2,
  bgColor:   0x06060f,
  gravity:   900,
  playerStart: { x: 3, y: 37 },
  layers: [
    { name: 'main', data: buildLevel2Data() },
  ],
  movingPlatforms: [
    { tileX: 5,  tileY: 13, width: 4, axis: 'h', range: 8, speed: 55 },
    { tileX: 22, tileY: 13, width: 4, axis: 'v', range: 5, speed: 45 },
    { tileX: 40, tileY: 13, width: 4, axis: 'h', range: 8, speed: 70 },
    { tileX: 10, tileY: 26, width: 4, axis: 'h', range: 10, speed: 65 },
    { tileX: 30, tileY: 26, width: 4, axis: 'v', range: 6,  speed: 50 },
    { tileX: 46, tileY: 26, width: 4, axis: 'h', range: 8,  speed: 60 },
  ],
  warps: [
    { fromX: 57, fromY: 36, toX: 3,  toY: 37, label: 'B1F→1F' },
    { fromX: 5,  fromY: 44, toX: 56, toY: 36, label: 'B1F→1F（別口）' },
    { fromX: 57, fromY: 44, toX: 3,  toY: 36, label: '最短ワープ' },
  ],
  enemies: [
    { tileX: 20, tileY: 36, type: 'thug' },
    { tileX: 30, tileY: 36, type: 'thug_red' },
    { tileX: 40, tileY: 36, type: 'thug',    triggerTileX: 25 },
    { tileX: 10, tileY: 24, type: 'thug_red', triggerTileX: 5 },
    { tileX: 45, tileY: 24, type: 'thug',    triggerTileX: 30 },
    { tileX: 10, tileY: 10, type: 'thug_red', triggerTileX: 5 },
    { tileX: 45, tileY: 10, type: 'thug_red', triggerTileX: 30 },
    { tileX: 30, tileY: 36, type: 'boss',    triggerTileX: 25 },
  ],
};

export const LEVEL_3_DEF: LevelDef = {
  name: '屋上アリーナ',
  mapWidth:  COLS_L3,
  mapHeight: ROWS_L3,
  bgColor:   0x050008,
  gravity:   900,
  playerStart: { x: 5, y: 19 },
  layers: [
    { name: 'main', data: buildLevel3Data() },
  ],
  movingPlatforms: [
    { tileX: 20, tileY: 5,  width: 4, axis: 'h', range: 12, speed: 80 },
    { tileX: 40, tileY: 5,  width: 4, axis: 'v', range: 6,  speed: 55 },
    { tileX: 56, tileY: 5,  width: 4, axis: 'h', range: 10, speed: 75 },
  ],
  warps: [
    { fromX: 38, fromY: 26, toX: 5,  toY: 19, label: 'クリア後ワープ（ループ）' },
    { fromX: 41, fromY: 26, toX: 5,  toY: 19 },
  ],
  enemies: [
    { tileX: 20, tileY: 19, type: 'thug_red' },
    { tileX: 55, tileY: 19, type: 'thug_red' },
    { tileX: 40, tileY: 19, type: 'boss',    triggerTileX: 15 },
  ],
};

export const ALL_LEVELS: LevelDef[] = [LEVEL_1_DEF, LEVEL_2_DEF, LEVEL_3_DEF];
