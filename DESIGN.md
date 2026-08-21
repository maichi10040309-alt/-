# データ設計・仕様メモ

このアプリはフレームワークを使わない vanilla TypeScript + Vite 構成です。
状態は `src/store.ts` の `Store` クラスが一元管理し、`localStorage`
(キー: `care-rental-billing-v1`)に丸ごと JSON で保存します。サーバーは
ありません。

## 画面構成(`src/ui/pages/*.ts`)

旧運用の「ボタンが多くて見にくい」「Excelが見にくい」という課題に対応する
ため、左メニューは5項目のみに絞っています。

- ホーム(`dashboard.ts`): 件数サマリーとよく使う操作への導線のみ
- 月次利用入力(`usage.ts`): 営業担当が毎月使う入力画面。品目・数量・単価を
  行単位で入力し、「前月の内容をコピー」で反復入力を省力化
- 請求書(`invoices.ts`): 基準月時点で締められた(=4か月分そろった)未請求
  サイクルの一覧、および発行済み含む全請求書の一覧。請求書ごとに
  作成→表示→発行→印刷の詳細画面(`renderInvoiceDetailPage`)へ遷移
- 利用者マスタ(`clients.ts`): 利用者の基本情報と「請求サイクル起算月」
- レンタル品目マスタ(`items.ts`): 品目と月額単価のマスタ
- 事業所情報設定(`settings.ts`, モーダル): 請求書に印字する自社情報

## データ型(`src/types.ts`)

- `Client`: 利用者。`billingStartMonth`(YYYY-MM)が4か月サイクルの起算月
- `RentalItem`: レンタル品目マスタ(品目名・分類・月額単価)
- `UsageEntry`: 利用者×対象月×品目 の実績1行。保存時に品目名・単価を
  スナップショットするため、後から品目マスタを変更しても過去実績は
  変わらない
- `Invoice`: 請求書。4か月分の `InvoiceMonth`(各月の明細と小計)を保持し、
  `status` が `draft`(下書き)→`issued`(発行済み)に遷移する

## 4か月ごとの請求サイクル計算(`src/utils/billing.ts`)

`getClientCycles(client, usageEntries, invoices, referenceMonth)` が
利用者の `billingStartMonth` を起点に4か月ずつのサイクルを列挙し、各サイクル
について以下を判定する。

- `isDue`: サイクル最終月が `referenceMonth` 以下なら請求可能とみなす
- `invoice`: そのサイクル(`cycleStartMonth`一致)で既に作成済みの請求書

「請求書」画面の基準月入力を変えることで、過去/将来のサイクル状況を確認
できる。請求書作成時は `buildInvoiceMonths()` が対象4か月分の `UsageEntry`
を集計し、月ごとの明細・小計・合計金額を持つ `Invoice` を生成する。

## 初期データ(`src/data/defaultItems.ts`)

代表的な介護用品(特殊寝台・車椅子・歩行器など)を初期の品目マスタとして
登録済み。単価は目安のため「レンタル品目マスタ」画面から自由に編集できる。

## 今後の拡張ポイント

- 請求書のCSV/PDFエクスポート(現状は画面印刷のみ)
- 品目マスタ変更時に過去の下書き請求書へ反映するかどうかの選択
- 複数事業所・複数営業担当でのログイン管理(現状は単一ブラウザ内で完結)
