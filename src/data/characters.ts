import type { CharacterDef } from '@/types';

function greetings(name: string, topic: string): [string, string, string, string, string] {
  return [
    `……あら、いらっしゃい。${name}です。ご用がなければまたどうぞ。`,
    `${name}だよ。最近ちょっとずつ話せるようになってきたね。`,
    `${name}です!${topic}の話、聞いてくれる?`,
    `また会えて嬉しいな。${name}、あなたと話すのが日課になってきたよ。`,
    `${name}にとって、もうあなたは特別な存在。いつもありがとう。`,
  ];
}

// 18人分、店舗配置・基本会話・好感度枠組みを最初から実装。
// 個別イベントシナリオは events.ts の汎用テンプレートを割り当て、後から差し替える。
export const CHARACTERS: CharacterDef[] = [
  { id: 'char_01', name: 'ミント', shopId: 'shop_01', personality: 'ふんわり優しいケーキ職人', favoriteMaterialId: 'mat_strawberry', color: '#ffb6c1', portrait: '/portraits/char_01.png', greetings: greetings('ミント', 'ケーキのデコレーション') },
  { id: 'char_02', name: 'ルミナ', shopId: 'shop_02', personality: 'きっちり者の粉商人', favoriteMaterialId: 'mat_flour', color: '#e9d8a6', portrait: '/portraits/char_02.png', greetings: greetings('ルミナ', '小麦の産地') },
  { id: 'char_03', name: 'ソレイユ', shopId: 'shop_03', personality: '詩を書くクッキー職人', favoriteMaterialId: 'mat_butter', color: '#ffd166', portrait: '/portraits/char_03.png', greetings: greetings('ソレイユ', '新作クッキーの詩') },
  { id: 'char_04', name: 'パティ', shopId: 'shop_04', personality: '牧場育ちの元気な酪農娘', favoriteMaterialId: 'mat_milk', color: '#caf0f8', portrait: '/portraits/char_04.png', greetings: greetings('パティ', '牧場の朝') },
  { id: 'char_05', name: 'キャンディ', shopId: 'shop_05', personality: 'プリン一筋の職人気質', favoriteMaterialId: 'mat_egg', color: '#fff3b0', portrait: '/portraits/char_05.png', greetings: greetings('キャンディ', 'プリンの黄金比') },
  { id: 'char_06', name: 'ベリー', shopId: 'shop_06', personality: '果樹園を営む天真爛漫な少女', favoriteMaterialId: 'mat_apple', color: '#ef476f', portrait: '/portraits/char_06.png', greetings: greetings('ベリー', '今年の果物の出来') },
  { id: 'char_07', name: 'ショコラ', shopId: 'shop_07', personality: 'クールなチョコレート職人', favoriteMaterialId: 'mat_chocolate', color: '#6f4518', portrait: '/portraits/char_07.png', greetings: greetings('ショコラ', 'カカオの発酵') },
  { id: 'char_08', name: 'ハニー', shopId: 'shop_08', personality: '養蜂を営む物静かな青年', favoriteMaterialId: 'mat_honey', color: '#f4a300', portrait: '/portraits/char_08.png', greetings: greetings('ハニー', '蜂たちの様子') },
  { id: 'char_09', name: 'マカロン', shopId: 'shop_09', personality: '甘い物に目がないムードメーカー', favoriteMaterialId: 'mat_sugar', color: '#ffc6ff', portrait: '/portraits/char_09.png', greetings: greetings('マカロン', '新作キャンディ') },
  { id: 'char_10', name: 'バニラ', shopId: 'shop_10', personality: '香りにこだわる商人', favoriteMaterialId: 'mat_vanilla', color: '#3d2b1f', portrait: '/portraits/char_10.png', greetings: greetings('バニラ', '香料の仕入れ') },
  { id: 'char_11', name: 'アップル', shopId: 'shop_11', personality: 'パイ作り一筋の頑固者', favoriteMaterialId: 'mat_apple', color: '#e63946', portrait: '/portraits/char_11.png', greetings: greetings('アップル', 'パイ生地のコツ') },
  { id: 'char_12', name: 'クリーム', shopId: 'shop_12', personality: 'ふわふわした癒し系', favoriteMaterialId: 'mat_cream', color: '#fffaf0', portrait: '/portraits/char_12.png', greetings: greetings('クリーム', '泡立て加減') },
  { id: 'char_13', name: 'タルティーヌ', shopId: 'shop_13', personality: '職人気質のタルト焼き', favoriteMaterialId: 'mat_lemon', color: '#fff275', portrait: '/portraits/char_13.png', greetings: greetings('タルティーヌ', 'タルト生地の配合') },
  { id: 'char_14', name: 'マチャ', shopId: 'shop_14', personality: '茶道にも通じる物知り', favoriteMaterialId: 'mat_matcha', color: '#6a994e', portrait: '/portraits/char_14.png', greetings: greetings('マチャ', '茶葉の挽き方') },
  { id: 'char_15', name: 'ロレーヌ', shopId: 'shop_15', personality: '旅好きなロールケーキ職人', favoriteMaterialId: 'mat_cream', color: '#bde0fe', portrait: '/portraits/char_15.png', greetings: greetings('ロレーヌ', '旅先で見た景色') },
  { id: 'char_16', name: 'ノヴァ', shopId: 'shop_16', personality: '珍しい素材を集める謎めいた人', favoriteMaterialId: 'mat_star_sugar', color: '#9d4edd', portrait: '/portraits/char_16.png', greetings: greetings('ノヴァ', '不思議な素材の噂') },
  { id: 'char_17', name: 'ジェラート', shopId: 'shop_17', personality: '陽気なアイス職人', favoriteMaterialId: 'mat_vanilla', color: '#90e0ef', portrait: '/portraits/char_17.png', greetings: greetings('ジェラート', '今日のおすすめフレーバー') },
  { id: 'char_18', name: 'ステラ', shopId: 'shop_18', personality: '星読みが得意な占い師気質', favoriteMaterialId: 'mat_star_sugar', color: '#ffd6ff', portrait: '/portraits/char_18.png', greetings: greetings('ステラ', '今夜の星模様') },
];

export function getCharacter(id: string): CharacterDef {
  const c = CHARACTERS.find((x) => x.id === id);
  if (!c) throw new Error(`unknown character: ${id}`);
  return c;
}
