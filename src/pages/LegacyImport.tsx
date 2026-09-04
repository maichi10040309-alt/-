import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import PageHeader from '../components/PageHeader';
import { newId } from '../utils/id';
import { formatMoney } from '../utils/format';
import { calcDocumentTotals } from '../utils/tax';
import {
  parseLegacyCsv,
  readLegacyCsvFile,
  resolveCustomers,
  resolveProducts,
  applyResolvedProductIds,
  buildSalesDocument,
  customerKeyOf,
  productKeyOf,
  analyzeMissingProductLinks,
  applyProductLinksToDocuments,
  repairConsolidatedInvoiceSourceTitles,
  type LegacyParseResult,
  type CustomerResolution,
  type ProductResolution,
  type ProductLinkAnalysis,
} from '../utils/legacyDocumentImport';
import { DOCUMENT_TYPE_LABEL, type Customer, type DocumentType, type Product, type SalesDocument } from '../types';

const IMPORT_TARGETS: DocumentType[] = ['quotation', 'delivery', 'invoice', 'consolidated_invoice', 'receipt'];
const CHUNK_SIZE = 2000;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

type CardState =
  | { phase: 'idle' }
  | { phase: 'parsing' }
  | {
      phase: 'preview';
      fileName: string;
      parsed: LegacyParseResult;
      resolution: CustomerResolution;
      productResolution: ProductResolution;
    }
  | { phase: 'importing'; progress: string }
  | { phase: 'done'; docCount: number; newCustomerCount: number; newProductCount: number; skippedCount: number }
  | { phase: 'error'; message: string };

function LegacyImportCard({ docType }: { docType: DocumentType }) {
  const [state, setState] = useState<CardState>({ phase: 'idle' });
  const label = DOCUMENT_TYPE_LABEL[docType];

  const handleFile = async (file: File) => {
    setState({ phase: 'parsing' });
    try {
      const text = await readLegacyCsvFile(file);
      const parsed = parseLegacyCsv(text, docType);
      if (parsed.rows.length === 0) {
        setState({ phase: 'error', message: '取り込める伝票が見つかりませんでした。CSVの形式をご確認ください。' });
        return;
      }
      const [existingCustomers, existingProducts] = await Promise.all([api.customers.list(), api.products.list()]);
      const resolution = resolveCustomers(parsed.rows, existingCustomers);
      const productResolution = resolveProducts(parsed.rows, existingProducts);
      setState({ phase: 'preview', fileName: file.name, parsed, resolution, productResolution });
    } catch (err) {
      setState({ phase: 'error', message: `CSVの読み込みに失敗しました: ${(err as Error).message}` });
    }
  };

  const handleConfirm = async () => {
    if (state.phase !== 'preview') return;
    const { parsed, resolution, productResolution } = state;
    setState({ phase: 'importing', progress: '新規得意先を登録中...' });
    try {
      const now = new Date().toISOString();
      const needCodeCount = resolution.newCustomers.filter((c) => !c.code).length;
      const issuedCodes = needCodeCount > 0 ? await api.customers.nextCodeBatch(needCodeCount) : [];
      let codeCursor = 0;
      const newCustomerRecords: Customer[] = resolution.newCustomers.map((draft) => ({
        id: newId(),
        code: draft.code || issuedCodes[codeCursor++],
        name: draft.name,
        kana: '',
        zip: draft.zip,
        address1: draft.address1,
        address2: draft.address2,
        tel: draft.tel,
        fax: draft.fax,
        email: '',
        contactPerson: draft.contactPerson,
        priceTier: 1,
        discountRate: 100,
        closingDay: 31,
        paymentMonthOffset: 1,
        paymentDay: 31,
        notes: '',
        createdAt: now,
        updatedAt: now,
      }));

      const customerBatches = chunk(newCustomerRecords, CHUNK_SIZE);
      for (let i = 0; i < customerBatches.length; i++) {
        setState({
          phase: 'importing',
          progress: `新規得意先を登録中... (${Math.min((i + 1) * CHUNK_SIZE, newCustomerRecords.length)}/${newCustomerRecords.length}件)`,
        });
        await api.customers.bulkPut(customerBatches[i]);
      }

      const keyToCustomerId = new Map(resolution.matchedByKey);
      newCustomerRecords.forEach((rec, i) => {
        keyToCustomerId.set(resolution.newCustomers[i].key, rec.id);
      });

      // 明細を商品台帳とひも付ける(得意先と同じ流れ:一致する商品が無ければ新規作成)。
      // これを行わないと、取り込んだ明細の「商品」欄が常に「(自由入力)」のままになってしまう。
      setState({ phase: 'importing', progress: '新規商品を登録中...' });
      const needProductCodeCount = productResolution.newProducts.filter((p) => !p.code).length;
      const issuedProductCodes =
        needProductCodeCount > 0 ? await api.products.nextCodeBatch(needProductCodeCount) : [];
      let productCodeCursor = 0;
      const newProductRecords: Product[] = productResolution.newProducts.map((draft) => ({
        id: newId(),
        code: draft.code || issuedProductCodes[productCodeCursor++],
        name: draft.name,
        category: '',
        unit: draft.unit,
        taxRate: draft.taxRate,
        prices: { price1: draft.unitPrice, price2: 0, price3: 0, cost: 0 },
        notes: '',
        createdAt: now,
        updatedAt: now,
      }));

      const productBatches = chunk(newProductRecords, CHUNK_SIZE);
      for (let i = 0; i < productBatches.length; i++) {
        setState({
          phase: 'importing',
          progress: `新規商品を登録中... (${Math.min((i + 1) * CHUNK_SIZE, newProductRecords.length)}/${newProductRecords.length}件)`,
        });
        await api.products.bulkPut(productBatches[i]);
      }

      const keyToProductId = new Map(productResolution.matchedByKey);
      newProductRecords.forEach((rec, i) => {
        keyToProductId.set(productKeyOf(productResolution.newProducts[i]), rec.id);
      });
      applyResolvedProductIds(parsed.rows, keyToProductId);

      const documents = parsed.rows.map((row) =>
        buildSalesDocument(row, docType, keyToCustomerId.get(customerKeyOf(row))!, now),
      );

      const docBatches = chunk(documents, CHUNK_SIZE);
      for (let i = 0; i < docBatches.length; i++) {
        setState({
          phase: 'importing',
          progress: `${label}を登録中... (${Math.min((i + 1) * CHUNK_SIZE, documents.length)}/${documents.length}件)`,
        });
        await api.documents.bulkPut(docBatches[i]);
      }

      setState({
        phase: 'done',
        docCount: documents.length,
        newCustomerCount: newCustomerRecords.length,
        newProductCount: newProductRecords.length,
        skippedCount: parsed.skippedRowCount,
      });
    } catch (err) {
      setState({ phase: 'error', message: `取り込みに失敗しました: ${(err as Error).message}` });
    }
  };

  return (
    <div className="card legacy-import-card">
      <h3 className="section-title">{label}</h3>

      {state.phase === 'idle' && (
        <label className="btn btn-secondary">
          CSVファイルを選択
          <input
            type="file"
            accept=".csv"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = '';
            }}
          />
        </label>
      )}

      {state.phase === 'parsing' && <p className="hint">解析中...</p>}

      {state.phase === 'preview' && (
        <div>
          <p className="hint">{state.fileName}</p>
          <p>
            {state.parsed.rows.length}件の{label}を読み込みました
            {state.parsed.skippedRowCount > 0 && `(対応する伝票番号のない行を${state.parsed.skippedRowCount}行スキップ)`}。
          </p>
          <p>
            得意先: 既存の得意先と一致 {state.resolution.matchedByKey.size}件 / 新しく作成 {state.resolution.newCustomers.length}
            件
          </p>
          <p>
            商品: 既存の商品と一致 {state.productResolution.matchedByKey.size}件 / 新しく作成{' '}
            {state.productResolution.newProducts.length}件
          </p>
          <div className="csv-preview-scroll">
            <table className="data-table compact">
              <thead>
                <tr>
                  <th>伝票番号</th>
                  <th>発行日</th>
                  <th>得意先</th>
                  <th>明細数</th>
                  <th>金額</th>
                </tr>
              </thead>
              <tbody>
                {state.parsed.rows.slice(0, 8).map((r) => {
                  const totals = calcDocumentTotals(r.items, 'floor');
                  return (
                    <tr key={r.number}>
                      <td>{r.number}</td>
                      <td>{r.issueDate}</td>
                      <td>{r.customerName}</td>
                      <td>{r.items.length}</td>
                      <td className="amount-cell">{formatMoney(totals.grandTotal)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="hint">
            先頭8件のプレビューです(全{state.parsed.rows.length}件)。取り込み後は一覧画面から個別に確認・修正できます。
          </p>
          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={() => setState({ phase: 'idle' })}>
              キャンセル
            </button>
            <button className="btn btn-primary" onClick={handleConfirm}>
              この内容で{state.parsed.rows.length}件を取り込む
            </button>
          </div>
        </div>
      )}

      {state.phase === 'importing' && <p className="hint">{state.progress}</p>}

      {state.phase === 'done' && (
        <div>
          <p>
            {state.docCount}件の{label}を取り込みました(新規得意先{state.newCustomerCount}件・新規商品{state.newProductCount}
            件を作成)。
          </p>
          <div className="modal-actions">
            <Link className="btn btn-secondary" to={`/documents/${docType}`}>
              一覧を見る
            </Link>
            <button className="btn btn-secondary" onClick={() => setState({ phase: 'idle' })}>
              別のファイルを取り込む
            </button>
          </div>
        </div>
      )}

      {state.phase === 'error' && (
        <div>
          <p className="hint legacy-import-error">{state.message}</p>
          <button className="btn btn-secondary" onClick={() => setState({ phase: 'idle' })}>
            やり直す
          </button>
        </div>
      )}
    </div>
  );
}

type RepairState =
  | { phase: 'idle' }
  | { phase: 'analyzing' }
  | { phase: 'preview'; analysis: ProductLinkAnalysis }
  | { phase: 'importing'; progress: string }
  | { phase: 'done'; documentCount: number; newProductCount: number }
  | { phase: 'error'; message: string };

// この機能を追加する前に取り込んだ伝票は、明細の商品コードの控えが残っていないため、
// 商品名の一致だけを頼りに、あとから商品台帳とひも付け直せるようにする画面。
function ProductLinkRepairCard() {
  const [state, setState] = useState<RepairState>({ phase: 'idle' });

  const handleAnalyze = async () => {
    setState({ phase: 'analyzing' });
    try {
      const [documents, products] = await Promise.all([api.documents.list(), api.products.list()]);
      const analysis = analyzeMissingProductLinks(documents, products);
      if (analysis.affectedItemCount === 0) {
        setState({ phase: 'done', documentCount: 0, newProductCount: 0 });
        return;
      }
      setState({ phase: 'preview', analysis });
    } catch (err) {
      setState({ phase: 'error', message: `分析に失敗しました: ${(err as Error).message}` });
    }
  };

  const handleConfirm = async () => {
    if (state.phase !== 'preview') return;
    const { analysis } = state;
    setState({ phase: 'importing', progress: '新規商品を登録中...' });
    try {
      const now = new Date().toISOString();
      const issuedCodes =
        analysis.newProducts.length > 0 ? await api.products.nextCodeBatch(analysis.newProducts.length) : [];
      const newProductRecords: Product[] = analysis.newProducts.map((draft, i) => ({
        id: newId(),
        code: issuedCodes[i],
        name: draft.name,
        category: '',
        unit: draft.unit,
        taxRate: draft.taxRate,
        prices: { price1: draft.unitPrice, price2: 0, price3: 0, cost: 0 },
        notes: '',
        createdAt: now,
        updatedAt: now,
      }));

      const productBatches = chunk(newProductRecords, CHUNK_SIZE);
      for (let i = 0; i < productBatches.length; i++) {
        setState({
          phase: 'importing',
          progress: `新規商品を登録中... (${Math.min((i + 1) * CHUNK_SIZE, newProductRecords.length)}/${newProductRecords.length}件)`,
        });
        await api.products.bulkPut(productBatches[i]);
      }

      const keyToProductId = new Map(analysis.matchedByKey);
      newProductRecords.forEach((rec, i) => {
        keyToProductId.set(analysis.newProducts[i].key, rec.id);
      });

      setState({ phase: 'importing', progress: '対象の伝票を確認中...' });
      const documents = await api.documents.list();
      const changed = applyProductLinksToDocuments(documents, keyToProductId, now);

      const docBatches = chunk(changed, CHUNK_SIZE);
      for (let i = 0; i < docBatches.length; i++) {
        setState({
          phase: 'importing',
          progress: `伝票を更新中... (${Math.min((i + 1) * CHUNK_SIZE, changed.length)}/${changed.length}件)`,
        });
        await api.documents.bulkPut(docBatches[i]);
      }

      setState({ phase: 'done', documentCount: changed.length, newProductCount: newProductRecords.length });
    } catch (err) {
      setState({ phase: 'error', message: `修正に失敗しました: ${(err as Error).message}` });
    }
  };

  return (
    <div className="card legacy-import-card">
      <h3 className="section-title">既存データの商品ひも付け修正</h3>
      <p className="hint">
        この機能を追加する前に取り込んだ伝票は、明細の「商品」欄が「(自由入力)」のままになっています。商品名が一致する既存の商品があれば自動でひも付け、無ければ商品台帳に新しく登録します(品名・単価などの明細の内容自体は変更しません)。
      </p>

      {state.phase === 'idle' && (
        <button className="btn btn-secondary" onClick={handleAnalyze}>
          対象を確認する
        </button>
      )}

      {state.phase === 'analyzing' && <p className="hint">分析中...(件数が多い場合、少し時間がかかります)</p>}

      {state.phase === 'preview' && (
        <div>
          <p>
            商品未設定の明細: {state.analysis.affectedItemCount.toLocaleString('ja-JP')}件(
            {state.analysis.affectedDocumentCount.toLocaleString('ja-JP')}件の伝票)
          </p>
          <p>
            商品: 既存の商品と一致 {state.analysis.matchedByKey.size}件 / 新しく作成{' '}
            {state.analysis.newProducts.length}件
          </p>
          {state.analysis.newProducts.length > 0 && (
            <div className="csv-preview-scroll">
              <table className="data-table compact">
                <thead>
                  <tr>
                    <th>商品名</th>
                    <th>単位</th>
                    <th>税率</th>
                    <th>単価(仮)</th>
                  </tr>
                </thead>
                <tbody>
                  {state.analysis.newProducts.slice(0, 8).map((p) => (
                    <tr key={p.key}>
                      <td>{p.name}</td>
                      <td>{p.unit}</td>
                      <td>{p.taxRate}%</td>
                      <td className="amount-cell">{formatMoney(p.unitPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="hint">
                先頭8件のプレビューです(全{state.analysis.newProducts.length}件)。単価・税率は明細の内容をそのまま仮登録するので、後から商品台帳で確認・調整してください。
              </p>
            </div>
          )}
          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={() => setState({ phase: 'idle' })}>
              キャンセル
            </button>
            <button className="btn btn-primary" onClick={handleConfirm}>
              この内容で修正する
            </button>
          </div>
        </div>
      )}

      {state.phase === 'importing' && <p className="hint">{state.progress}</p>}

      {state.phase === 'done' && (
        <div>
          <p>
            {state.documentCount > 0
              ? `${state.documentCount}件の伝票を修正しました(新規商品${state.newProductCount}件を作成)。`
              : '商品未設定の明細は見つかりませんでした。'}
          </p>
          <button className="btn btn-secondary" onClick={() => setState({ phase: 'idle' })}>
            閉じる
          </button>
        </div>
      )}

      {state.phase === 'error' && (
        <div>
          <p className="hint legacy-import-error">{state.message}</p>
          <button className="btn btn-secondary" onClick={() => setState({ phase: 'idle' })}>
            やり直す
          </button>
        </div>
      )}
    </div>
  );
}

type TitleRepairState =
  | { phase: 'idle' }
  | { phase: 'analyzing' }
  | { phase: 'preview'; changed: SalesDocument[] }
  | { phase: 'importing'; progress: string }
  | { phase: 'done'; count: number }
  | { phase: 'error'; message: string };

// 締め処理で発行した合計請求書の印刷画面で「品番・品名」欄が空欄になる不具合(元の納品書に
// 件名が無いため)を、この修正より前に発行済みの合計請求書について後から埋め直す画面。
function ConsolidatedTitleRepairCard() {
  const [state, setState] = useState<TitleRepairState>({ phase: 'idle' });

  const handleAnalyze = async () => {
    setState({ phase: 'analyzing' });
    try {
      const documents = await api.documents.list();
      const changed = repairConsolidatedInvoiceSourceTitles(documents, new Date().toISOString());
      if (changed.length === 0) {
        setState({ phase: 'done', count: 0 });
        return;
      }
      setState({ phase: 'preview', changed });
    } catch (err) {
      setState({ phase: 'error', message: `分析に失敗しました: ${(err as Error).message}` });
    }
  };

  const handleConfirm = async () => {
    if (state.phase !== 'preview') return;
    const { changed } = state;
    setState({ phase: 'importing', progress: '更新中...' });
    try {
      const batches = chunk(changed, CHUNK_SIZE);
      for (let i = 0; i < batches.length; i++) {
        setState({
          phase: 'importing',
          progress: `更新中... (${Math.min((i + 1) * CHUNK_SIZE, changed.length)}/${changed.length}件)`,
        });
        await api.documents.bulkPut(batches[i]);
      }
      setState({ phase: 'done', count: changed.length });
    } catch (err) {
      setState({ phase: 'error', message: `修正に失敗しました: ${(err as Error).message}` });
    }
  };

  return (
    <div className="card legacy-import-card">
      <h3 className="section-title">合計請求書の品名修正</h3>
      <p className="hint">
        締め処理で発行した合計請求書は、印刷画面の明細表(品番・品名の欄)が空欄になっていることがありました。元になった納品書がまだ残っていれば、そこから品名を補って埋め直します。
      </p>

      {state.phase === 'idle' && (
        <button className="btn btn-secondary" onClick={handleAnalyze}>
          対象を確認する
        </button>
      )}

      {state.phase === 'analyzing' && <p className="hint">分析中...</p>}

      {state.phase === 'preview' && (
        <div>
          <p>{state.changed.length}件の合計請求書を修正できます。</p>
          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={() => setState({ phase: 'idle' })}>
              キャンセル
            </button>
            <button className="btn btn-primary" onClick={handleConfirm}>
              この内容で修正する
            </button>
          </div>
        </div>
      )}

      {state.phase === 'importing' && <p className="hint">{state.progress}</p>}

      {state.phase === 'done' && (
        <div>
          <p>
            {state.count > 0
              ? `${state.count}件の合計請求書を修正しました。`
              : '修正が必要な合計請求書は見つかりませんでした。'}
          </p>
          <button className="btn btn-secondary" onClick={() => setState({ phase: 'idle' })}>
            閉じる
          </button>
        </div>
      )}

      {state.phase === 'error' && (
        <div>
          <p className="hint legacy-import-error">{state.message}</p>
          <button className="btn btn-secondary" onClick={() => setState({ phase: 'idle' })}>
            やり直す
          </button>
        </div>
      )}
    </div>
  );
}

export default function LegacyImport() {
  return (
    <div>
      <PageHeader
        title="過去データの取り込み"
        subtitle="他の販売管理ソフトから書き出したCSVを、見積書・納品書・請求書・合計請求書・領収証として取り込みます"
      />
      <div className="card">
        <p className="hint">
          「伝票番号・得意先情報・明細」を持つCSV(1明細=1行の形式)に対応しています。同じ得意先コードまたは同じ名前の得意先が既に登録されていれば自動でひも付け、なければ新しく得意先を作成します。
          商品も同様に、商品コードまたは商品名が一致する既存の商品があれば自動でひも付け、無ければ商品台帳に新しく登録します(価格・税率は明細の内容を仮の値として登録するので、後から商品台帳で確認・調整してください)。
          件数が多いファイル(数万件)の取り込みには数十秒〜数分かかる場合があります。念のため、取り込み前に「設定」画面からバックアップを保存しておくことをおすすめします。
        </p>
        <p className="hint">
          「請求書」と「合計請求書」はCSVの形式が同じ場合が多いため、旧ソフト側でどちらの帳票として発行していたかに合わせて、取り込み先のカードを選んでください。
        </p>
        <p className="hint">
          同じCSVを2回取り込むと伝票が重複しますのでご注意ください。伝票番号は元のCSVの値をそのまま引き継ぎます。
        </p>
        <Link className="link" to="/settings">
          設定画面でバックアップを保存する
        </Link>
      </div>

      <div className="legacy-import-grid">
        {IMPORT_TARGETS.map((docType) => (
          <LegacyImportCard key={docType} docType={docType} />
        ))}
      </div>

      <ProductLinkRepairCard />
      <ConsolidatedTitleRepairCard />
    </div>
  );
}
