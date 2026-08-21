import type { RentalItem } from '@/types';

// 初期投入する介護用品レンタル品目マスタ(月額単価は目安。後から編集可能)
export const DEFAULT_ITEMS: Omit<RentalItem, 'id'>[] = [
  { name: '特殊寝台(介護ベッド)', category: '寝台関連', unitPrice: 10000, note: '' },
  { name: '特殊寝台付属品(マットレス)', category: '寝台関連', unitPrice: 3000, note: '' },
  { name: '車椅子(標準型)', category: '移動関連', unitPrice: 5000, note: '' },
  { name: '車椅子付属品(クッション等)', category: '移動関連', unitPrice: 1500, note: '' },
  { name: '歩行器', category: '歩行補助', unitPrice: 3000, note: '' },
  { name: '歩行補助杖', category: '歩行補助', unitPrice: 1000, note: '' },
  { name: 'スロープ', category: '移動関連', unitPrice: 2000, note: '' },
  { name: '手すり(工事不要)', category: '住宅改修関連', unitPrice: 2000, note: '' },
  { name: '床ずれ防止用具(エアマット)', category: '寝台関連', unitPrice: 4000, note: '' },
  { name: '認知症老人徘徊感知機器', category: '見守り関連', unitPrice: 3000, note: '' },
  { name: '移動用リフト', category: '移動関連', unitPrice: 8000, note: '' },
  { name: '自動排泄処理装置', category: '排泄関連', unitPrice: 12000, note: '' },
];
