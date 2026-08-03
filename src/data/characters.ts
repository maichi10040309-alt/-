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

// 17人のNPC。プレイヤー(ストロベリー、いちごケーキ店主)は別枠で管理する。
// 好感度・イベントの枠組みは最初から全員分実装し、個別イベントシナリオは
// events.ts の汎用テンプレートを割り当てて後から差し替える方針。
export const CHARACTERS: CharacterDef[] = [
  { id: 'white', name: 'ホワイト', shopId: 'shop_white', personality: 'おっとりしたお嬢様', favoriteMaterialId: 'mat_cream', color: '#a8cbe8', portrait: 'white', greetings: greetings('ホワイト', '高級ケーキの飾り付け') },
  { id: 'bitter', name: 'ビター', shopId: 'shop_bitter', personality: 'クールで頭脳派', favoriteMaterialId: 'mat_chocolate', color: '#4a3626', portrait: 'bitter', greetings: greetings('ビター', 'カカオの配合') },
  { id: 'milk', name: 'ミルク', shopId: 'shop_milk', personality: 'やさしく包容力がある男の子', favoriteMaterialId: 'mat_milk', color: '#e0b45a', portrait: 'milk', greetings: greetings('ミルク', '焼きたてパンの香り') },
  { id: 'matcha', name: '抹茶', shopId: 'shop_matcha', personality: '真面目で控えめな女の子', favoriteMaterialId: 'mat_matcha', color: '#7a9a5a', portrait: 'matcha', greetings: greetings('抹茶', '和菓子と抹茶の相性') },
  { id: 'crunch', name: 'クランチ', shopId: 'shop_crunch', personality: 'クッキー作りが得意な几帳面な男の子', favoriteMaterialId: 'mat_flour', color: '#8a5a3c', portrait: 'crunch', greetings: greetings('クランチ', '新作クッキーの配合') },
  { id: 'marron', name: 'マロン', shopId: 'shop_marron', personality: '田舎育ちの素朴な女の子。チーズも大好き', favoriteMaterialId: 'mat_almond', color: '#7a4a35', portrait: 'marron', greetings: greetings('マロン', 'モンブランの絞り方') },
  { id: 'champagne', name: 'シャンパン', shopId: 'shop_champagne', personality: 'お金持ちでキザな男の子', favoriteMaterialId: 'mat_vanilla', color: '#cfa855', portrait: 'champagne', greetings: greetings('シャンパン', '記念日ケーキの注文') },
  { id: 'peche', name: 'ペシェ', shopId: 'shop_peche', personality: '桃が大好きな女の子', favoriteMaterialId: 'mat_honey', color: '#f0a8a8', portrait: 'peche', greetings: greetings('ペシェ', '今年の桃の出来') },
  { id: 'pomme', name: 'ボンム', shopId: 'shop_pomme', personality: '恋する女の子', favoriteMaterialId: 'mat_apple', color: '#d8452f', portrait: 'pomme', greetings: greetings('ボンム', '気になるあの人のこと') },
  { id: 'almond', name: 'アーモンド', shopId: 'shop_almond', personality: '読書が大好きな知的な男の子。焼き菓子も得意', favoriteMaterialId: 'mat_almond', color: '#6a4a30', portrait: 'almond', greetings: greetings('アーモンド', '最近読んだレシピ本') },
  { id: 'honey', name: 'ハニー', shopId: 'shop_honey', personality: 'はちみつが大好きな明るい女の子', favoriteMaterialId: 'mat_honey', color: '#e8b23a', portrait: 'honey', greetings: greetings('ハニー', '蜂たちの様子') },
  { id: 'caramel', name: 'キャラメル', shopId: 'shop_caramel', personality: '甘いものが大好きな女の子', favoriteMaterialId: 'mat_sugar', color: '#a8703c', portrait: 'caramel', greetings: greetings('キャラメル', 'プリンの焦がし加減') },
  { id: 'blueberry', name: 'ブルーベリー', shopId: 'shop_blueberry', personality: '落ち着いた性格の女の子', favoriteMaterialId: 'mat_strawberry', color: '#8a6ab5', portrait: 'blueberry', greetings: greetings('ブルーベリー', 'ベリータルトの配合') },
  { id: 'maple', name: 'メープル', shopId: 'shop_maple', personality: '元気いっぱいの女の子。パンケーキとシロップが自慢', favoriteMaterialId: 'mat_honey', color: '#d8792a', portrait: 'maple', greetings: greetings('メープル', 'パンケーキの焼き加減') },
  { id: 'cinnamon', name: 'シナモン', shopId: 'shop_cinnamon', personality: '大人っぽいお姉さん', favoriteMaterialId: 'mat_flour', color: '#a0693a', portrait: 'cinnamon', greetings: greetings('シナモン', '香り付けのコツ') },
  { id: 'lemon', name: 'レモン', shopId: 'shop_lemon', personality: '爽やかな性格の女の子', favoriteMaterialId: 'mat_lemon', color: '#e8d048', portrait: 'lemon', greetings: greetings('レモン', 'レモンの仕入れ') },
  { id: 'vanilla', name: 'バニラ', shopId: 'shop_vanilla', personality: 'やさしくておっとりした女の子', favoriteMaterialId: 'mat_vanilla', color: '#f0e6cc', portrait: 'vanilla', greetings: greetings('バニラ', 'クリームの泡立て方') },
];

export function getCharacter(id: string): CharacterDef {
  const c = CHARACTERS.find((x) => x.id === id);
  if (!c) throw new Error(`unknown character: ${id}`);
  return c;
}
