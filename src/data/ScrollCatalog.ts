import type { ScrollData } from '../types';
import { TileType, MachineType, MachineTier, Direction } from '../types';

// Chapter 1: Foundations — JLPT N5 basics
// Each scroll introduces a small set of new kanji through a curated text

const scrolls: ScrollData[] = [
  {
    id: 'scroll-1-01',
    chapter: 1,
    title: 'First Light',
    titleJp: '初めの光',
    sourceText: '日が山から出る。一人の人が大きい木の下に立つ。',
    translation: 'The sun rises from the mountain. A person stands under a large tree.',
    newKanji: ['日', '山', '一', '人', '大', '木'],
    revisionKanji: [],
    culturalNote: 'This passage evokes a classic scene from Japanese ink painting (sumi-e), where nature and human figures exist in harmony. The simplicity of the characters mirrors the simplicity of the brushstrokes.',
    dispatchQuotas: [
      { kanji: '日', quantity: 2, fulfilled: 0, timeWindowSeconds: 180, rewardMultiplier: 1.5 },
      { kanji: '山', quantity: 2, fulfilled: 0, timeWindowSeconds: 180, rewardMultiplier: 1.5 },
      { kanji: '人', quantity: 1, fulfilled: 0, timeWindowSeconds: 240, rewardMultiplier: 2.0 },
    ],
    mapData: {
      seed: 101,
      width: 30,
      height: 20,
      tiles: [], // Will be generated
      machines: [],
      belts: [],
      oreNodes: [
        { radical: '日', x: 4, y: 5, richness: 3 },
        { radical: '山', x: 4, y: 10, richness: 3 },
        { radical: '一', x: 4, y: 15, richness: 3 },
        { radical: '人', x: 15, y: 5, richness: 3 },
        { radical: '大', x: 15, y: 10, richness: 3 },
        { radical: '木', x: 15, y: 15, richness: 3 },
      ],
      orderQueue: ['日', '山', '一', '人', '大', '木'],
      dispatchQuotas: [],
    },
  },
  {
    id: 'scroll-1-02',
    chapter: 1,
    title: 'Running Water',
    titleJp: '流れる水',
    sourceText: '川の水は小さい石の上を流れる。月の光が水の中に入る。',
    translation: 'The river water flows over small stones. Moonlight enters the water.',
    newKanji: ['川', '水', '小', '月'],
    revisionKanji: ['日', '山', '人'],
    culturalNote: 'Water (水) is one of the five classical elements in Japanese philosophy. Rivers were central to Edo-period life, providing transport, food, and inspiration for countless poems.',
    dispatchQuotas: [
      { kanji: '川', quantity: 2, fulfilled: 0, timeWindowSeconds: 180, rewardMultiplier: 1.5 },
      { kanji: '水', quantity: 2, fulfilled: 0, timeWindowSeconds: 180, rewardMultiplier: 1.5 },
      { kanji: '月', quantity: 2, fulfilled: 0, timeWindowSeconds: 200, rewardMultiplier: 1.8 },
    ],
    mapData: {
      seed: 102,
      width: 30,
      height: 20,
      tiles: [],
      machines: [],
      belts: [],
      oreNodes: [
        { radical: '川', x: 3, y: 5, richness: 3 },
        { radical: '水', x: 3, y: 10, richness: 3 },
        { radical: '小', x: 3, y: 15, richness: 3 },
        { radical: '月', x: 14, y: 5, richness: 3 },
        { radical: '日', x: 14, y: 10, richness: 2 },
        { radical: '山', x: 14, y: 15, richness: 2 },
        { radical: '人', x: 25, y: 10, richness: 2 },
      ],
      orderQueue: ['川', '水', '小', '月'],
      dispatchQuotas: [],
    },
  },
  {
    id: 'scroll-1-03',
    chapter: 1,
    title: 'Fire and Metal',
    titleJp: '火と金',
    sourceText: '火が金を溶かす。土の上で金が光る。口から言葉が出る。',
    translation: 'Fire melts metal. Gold shines on the earth. Words come from the mouth.',
    newKanji: ['火', '金', '土', '口'],
    revisionKanji: ['日', '大', '木', '水'],
    culturalNote: 'The five elements (五行 gogyō) — wood, fire, earth, metal, water — form a fundamental cycle in East Asian philosophy. This passage touches on three of them.',
    dispatchQuotas: [
      { kanji: '火', quantity: 2, fulfilled: 0, timeWindowSeconds: 180, rewardMultiplier: 1.5 },
      { kanji: '金', quantity: 2, fulfilled: 0, timeWindowSeconds: 200, rewardMultiplier: 2.0 },
      { kanji: '土', quantity: 1, fulfilled: 0, timeWindowSeconds: 180, rewardMultiplier: 1.5 },
    ],
    mapData: {
      seed: 103,
      width: 30,
      height: 20,
      tiles: [],
      machines: [],
      belts: [],
      oreNodes: [
        { radical: '火', x: 3, y: 5, richness: 3 },
        { radical: '金', x: 3, y: 10, richness: 3 },
        { radical: '土', x: 3, y: 15, richness: 3 },
        { radical: '口', x: 14, y: 5, richness: 3 },
        { radical: '日', x: 14, y: 10, richness: 2 },
        { radical: '大', x: 14, y: 15, richness: 2 },
        { radical: '木', x: 25, y: 8, richness: 2 },
        { radical: '水', x: 25, y: 12, richness: 2 },
      ],
      orderQueue: ['火', '金', '土', '口'],
      dispatchQuotas: [],
    },
  },
  {
    id: 'scroll-1-04',
    chapter: 1,
    title: 'Under the Sky',
    titleJp: '空の下',
    sourceText: '天の下、田んぼに男と女が立つ。子供が目を大きく開ける。',
    translation: 'Under the sky, a man and a woman stand in the rice field. A child opens their eyes wide.',
    newKanji: ['天', '田', '男', '女', '子', '目'],
    revisionKanji: ['大', '人', '口', '火', '山'],
    culturalNote: 'Rice paddies (田) are the foundation of Japanese civilization. The character itself is a pictograph of a divided field, one of the most ancient kanji forms still in use today.',
    dispatchQuotas: [
      { kanji: '天', quantity: 1, fulfilled: 0, timeWindowSeconds: 180, rewardMultiplier: 1.5 },
      { kanji: '田', quantity: 2, fulfilled: 0, timeWindowSeconds: 200, rewardMultiplier: 1.5 },
      { kanji: '男', quantity: 1, fulfilled: 0, timeWindowSeconds: 240, rewardMultiplier: 2.5 },
    ],
    mapData: {
      seed: 104,
      width: 35,
      height: 25,
      tiles: [],
      machines: [],
      belts: [],
      oreNodes: [
        { radical: '天', x: 3, y: 5, richness: 3 },
        { radical: '田', x: 3, y: 10, richness: 3 },
        { radical: '男', x: 3, y: 15, richness: 3 },
        { radical: '女', x: 3, y: 20, richness: 3 },
        { radical: '子', x: 16, y: 5, richness: 3 },
        { radical: '目', x: 16, y: 10, richness: 3 },
        { radical: '大', x: 16, y: 15, richness: 2 },
        { radical: '人', x: 16, y: 20, richness: 2 },
        { radical: '口', x: 28, y: 8, richness: 2 },
        { radical: '火', x: 28, y: 14, richness: 2 },
        { radical: '山', x: 28, y: 20, richness: 2 },
      ],
      orderQueue: ['天', '田', '男', '女', '子', '目'],
      dispatchQuotas: [],
    },
  },
  {
    id: 'scroll-1-05',
    chapter: 1,
    title: 'Counting Days',
    titleJp: '日を数える',
    sourceText: '二つの手で三つの花を持つ。四つの石の上に五本の竹が生える。',
    translation: 'Hold three flowers with two hands. Five bamboo grow on four stones.',
    newKanji: ['二', '三', '四', '五', '手', '花'],
    revisionKanji: ['一', '大', '木', '山', '土'],
    culturalNote: 'Japanese number kanji (一二三) are among the oldest and most elegant — simple horizontal strokes counting upward. The word for flower (花) combines the radical for plant (艹) with the concept of transformation (化).',
    dispatchQuotas: [
      { kanji: '二', quantity: 2, fulfilled: 0, timeWindowSeconds: 150, rewardMultiplier: 1.2 },
      { kanji: '三', quantity: 2, fulfilled: 0, timeWindowSeconds: 150, rewardMultiplier: 1.2 },
      { kanji: '手', quantity: 1, fulfilled: 0, timeWindowSeconds: 200, rewardMultiplier: 2.0 },
    ],
    mapData: {
      seed: 105,
      width: 35,
      height: 25,
      tiles: [],
      machines: [],
      belts: [],
      oreNodes: [
        { radical: '二', x: 4, y: 5, richness: 3 },
        { radical: '三', x: 4, y: 10, richness: 3 },
        { radical: '四', x: 4, y: 15, richness: 3 },
        { radical: '五', x: 4, y: 20, richness: 3 },
        { radical: '手', x: 16, y: 5, richness: 3 },
        { radical: '花', x: 16, y: 10, richness: 3 },
        { radical: '一', x: 16, y: 15, richness: 2 },
        { radical: '大', x: 16, y: 20, richness: 2 },
        { radical: '木', x: 28, y: 8, richness: 2 },
        { radical: '山', x: 28, y: 14, richness: 2 },
        { radical: '土', x: 28, y: 20, richness: 2 },
      ],
      orderQueue: ['二', '三', '四', '五', '手', '花'],
      dispatchQuotas: [],
    },
  },
  {
    id: 'scroll-1-06',
    chapter: 1,
    title: 'The Gate',
    titleJp: '門',
    sourceText: '大きい門の中に入る。学校で先生が本を読む。生徒は耳で聞く。',
    translation: 'Enter through the great gate. At school, the teacher reads a book. The students listen with their ears.',
    newKanji: ['門', '中', '学', '先', '本', '耳'],
    revisionKanji: ['大', '人', '日', '目', '口', '子'],
    culturalNote: 'The gate (門) is both a physical and metaphorical threshold in Japanese culture. Temple gates (山門) mark the transition from the mundane to the sacred. In this game, the Pronunciation Gate serves a similar purpose — a threshold of knowledge.',
    dispatchQuotas: [
      { kanji: '門', quantity: 1, fulfilled: 0, timeWindowSeconds: 200, rewardMultiplier: 2.0 },
      { kanji: '学', quantity: 2, fulfilled: 0, timeWindowSeconds: 240, rewardMultiplier: 2.0 },
      { kanji: '本', quantity: 2, fulfilled: 0, timeWindowSeconds: 200, rewardMultiplier: 1.5 },
    ],
    mapData: {
      seed: 106,
      width: 35,
      height: 25,
      tiles: [],
      machines: [],
      belts: [],
      oreNodes: [
        { radical: '門', x: 4, y: 5, richness: 3 },
        { radical: '中', x: 4, y: 10, richness: 3 },
        { radical: '学', x: 4, y: 15, richness: 3 },
        { radical: '先', x: 4, y: 20, richness: 3 },
        { radical: '本', x: 16, y: 5, richness: 3 },
        { radical: '耳', x: 16, y: 10, richness: 3 },
        { radical: '大', x: 16, y: 15, richness: 2 },
        { radical: '人', x: 16, y: 20, richness: 2 },
        { radical: '日', x: 28, y: 5, richness: 2 },
        { radical: '目', x: 28, y: 10, richness: 2 },
        { radical: '口', x: 28, y: 15, richness: 2 },
        { radical: '子', x: 28, y: 20, richness: 2 },
      ],
      orderQueue: ['門', '中', '学', '先', '本', '耳'],
      dispatchQuotas: [],
    },
  },
];

export class ScrollCatalog {
  static getAllScrolls(): ScrollData[] {
    return scrolls;
  }

  static getScrollsByChapter(chapter: number): ScrollData[] {
    return scrolls.filter(s => s.chapter === chapter);
  }

  static getScroll(id: string): ScrollData | undefined {
    return scrolls.find(s => s.id === id);
  }

  static getChapterCount(): number {
    return Math.max(...scrolls.map(s => s.chapter));
  }

  static getScrollCount(): number {
    return scrolls.length;
  }
}
