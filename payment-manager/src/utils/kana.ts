// 全角カタカナ/英数字 → 半角(JIS X 0201)への変換と検証。
// 全銀フォーマットの各フィールド(受取人名カナ等)は半角カタカナ・半角英数字のみ許可される。

const KATAKANA_BASE: Record<string, string> = {
  'ァ': 'ァ', 'ア': 'ア', 'ィ': 'ィ', 'イ': 'イ', 'ゥ': 'ゥ', 'ウ': 'ウ',
  'ェ': 'ェ', 'エ': 'エ', 'ォ': 'ォ', 'オ': 'オ',
  'カ': 'カ', 'キ': 'キ', 'ク': 'ク', 'ケ': 'ケ', 'コ': 'コ',
  'サ': 'サ', 'シ': 'シ', 'ス': 'ス', 'セ': 'セ', 'ソ': 'ソ',
  'タ': 'タ', 'チ': 'チ', 'ッ': 'ッ', 'ツ': 'ツ', 'テ': 'テ', 'ト': 'ト',
  'ナ': 'ナ', 'ニ': 'ニ', 'ヌ': 'ヌ', 'ネ': 'ネ', 'ノ': 'ノ',
  'ハ': 'ハ', 'ヒ': 'ヒ', 'フ': 'フ', 'ヘ': 'ヘ', 'ホ': 'ホ',
  'マ': 'マ', 'ミ': 'ミ', 'ム': 'ム', 'メ': 'メ', 'モ': 'モ',
  'ャ': 'ャ', 'ヤ': 'ヤ', 'ュ': 'ュ', 'ユ': 'ユ', 'ョ': 'ョ', 'ヨ': 'ヨ',
  'ラ': 'ラ', 'リ': 'リ', 'ル': 'ル', 'レ': 'レ', 'ロ': 'ロ',
  'ワ': 'ワ', 'ヲ': 'ヲ', 'ン': 'ン', 'ー': 'ー',
  '、': '、', '。': '。', '・': '・', '「': '「', '」': '」',
};

// 濁点・半濁点付きの全角カタカナ → 半角基本文字 + 半角濁点/半濁点
const KATAKANA_DAKUTEN: Record<string, string> = {
  'ガ': 'ガ', 'ギ': 'ギ', 'グ': 'グ', 'ゲ': 'ゲ', 'ゴ': 'ゴ',
  'ザ': 'ザ', 'ジ': 'ジ', 'ズ': 'ズ', 'ゼ': 'ゼ', 'ゾ': 'ゾ',
  'ダ': 'ダ', 'ヂ': 'ヂ', 'ヅ': 'ヅ', 'デ': 'デ', 'ド': 'ド',
  'バ': 'バ', 'ビ': 'ビ', 'ブ': 'ブ', 'ベ': 'ベ', 'ボ': 'ボ',
  'パ': 'パ', 'ピ': 'ピ', 'プ': 'プ', 'ペ': 'ペ', 'ポ': 'ポ',
  'ヴ': 'ヴ',
};

/** 全角カタカナ・全角英数字・全角スペースを半角に変換する(カナ以外の全角文字はそのまま残す)。 */
export function toHalfWidthKana(input: string): string {
  let out = '';
  for (const ch of input) {
    if (KATAKANA_DAKUTEN[ch]) {
      out += KATAKANA_DAKUTEN[ch];
    } else if (KATAKANA_BASE[ch]) {
      out += KATAKANA_BASE[ch];
    } else if (ch === '　') {
      out += ' ';
    } else {
      const code = ch.codePointAt(0)!;
      if (code >= 0xff01 && code <= 0xff5e) {
        out += String.fromCharCode(code - 0xfee0);
      } else {
        out += ch;
      }
    }
  }
  return out;
}

/** 半角カタカナ+半角英数字+スペースのみで構成されているか判定する(全銀フォーマットで使用可能な文字集合)。 */
export function isZenginSafeText(text: string): boolean {
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    const isAscii = code >= 0x20 && code <= 0x7e;
    const isHalfKana = code >= 0xff61 && code <= 0xff9f;
    if (!isAscii && !isHalfKana) return false;
  }
  return true;
}

/** 半角変換した上で全銀フォーマットで使用できない文字を除去した文字列を返す。 */
export function sanitizeToZenginText(input: string): string {
  const half = toHalfWidthKana(input);
  let out = '';
  for (const ch of half) {
    const code = ch.codePointAt(0)!;
    const isAscii = code >= 0x20 && code <= 0x7e;
    const isHalfKana = code >= 0xff61 && code <= 0xff9f;
    if (isAscii || isHalfKana) out += ch;
  }
  return out;
}
