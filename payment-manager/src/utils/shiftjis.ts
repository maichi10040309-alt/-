// ASCII(JIS X0201ローマ字)+半角カタカナのみを対象にした簡易Shift-JISエンコーダ。
// 全銀フォーマットで使用する文字種はこの範囲に限られるため、フルセットのShift-JIS実装は不要。

function encodeChar(ch: string): number {
  const code = ch.codePointAt(0)!;
  if (code === 0x0d || code === 0x0a || code === 0x09) return code; // CR/LF/TAB
  if (code >= 0x20 && code <= 0x7e) return code;
  if (code >= 0xff61 && code <= 0xff9f) return code - 0xff61 + 0xa1;
  throw new Error(`Shift-JISに変換できない文字が含まれています: "${ch}" (U+${code.toString(16)})`);
}

export function encodeShiftJIS(text: string): Uint8Array {
  const bytes: number[] = [];
  for (const ch of text) {
    bytes.push(encodeChar(ch));
  }
  return new Uint8Array(bytes);
}
