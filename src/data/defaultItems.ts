import type { RentalItem } from '@/types';

// 初期投入するレンタル品目マスタ。
// 介護保険品目(billingType: 'insurance')は単位数×利用者負担割合で自己負担額を自動計算するため、
// unitPriceは使用しない(0)。自費品目(billingType: 'private')はunitPriceを目安の月額として使用する。
export const DEFAULT_ITEMS: Omit<RentalItem, 'id'>[] = [
  { name: '車いす', category: '介護保険品目', billingType: 'insurance', unitPrice: 0, note: '' },
  { name: '車いす付属品', category: '介護保険品目', billingType: 'insurance', unitPrice: 0, note: '' },
  { name: '予防給付車いす', category: '介護保険品目', billingType: 'insurance', unitPrice: 0, note: '' },
  { name: '特殊寝台', category: '介護保険品目', billingType: 'insurance', unitPrice: 0, note: '' },
  { name: '特殊寝台付属品', category: '介護保険品目', billingType: 'insurance', unitPrice: 0, note: '' },
  { name: '床ずれ防止用具', category: '介護保険品目', billingType: 'insurance', unitPrice: 0, note: '' },
  { name: '体位変換器', category: '介護保険品目', billingType: 'insurance', unitPrice: 0, note: '' },
  { name: '手すり', category: '介護保険品目', billingType: 'insurance', unitPrice: 0, note: '' },
  { name: '予防給付手すり', category: '介護保険品目', billingType: 'insurance', unitPrice: 0, note: '' },
  { name: 'スロープ', category: '介護保険品目', billingType: 'insurance', unitPrice: 0, note: '' },
  { name: '歩行器', category: '介護保険品目', billingType: 'insurance', unitPrice: 0, note: '' },
  { name: '予防給付歩行器', category: '介護保険品目', billingType: 'insurance', unitPrice: 0, note: '' },
  { name: '歩行補助杖', category: '介護保険品目', billingType: 'insurance', unitPrice: 0, note: '' },
  { name: '予防給付歩行補助杖', category: '介護保険品目', billingType: 'insurance', unitPrice: 0, note: '' },
  { name: '認知症老人徘徊感知機器', category: '介護保険品目', billingType: 'insurance', unitPrice: 0, note: '' },
  { name: '移動用リフト', category: '介護保険品目', billingType: 'insurance', unitPrice: 0, note: '' },
  { name: '自費ベッド', category: '自費品目', billingType: 'private', unitPrice: 1500, note: '' },
  { name: '自費サイドテーブル', category: '自費品目', billingType: 'private', unitPrice: 2040, note: '' },
];
