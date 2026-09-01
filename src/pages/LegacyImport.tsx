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
  buildSalesDocument,
  customerKeyOf,
  type LegacyParseResult,
  type CustomerResolution,
} from '../utils/legacyDocumentImport';
import { DOCUMENT_TYPE_LABEL, type Customer, type DocumentType } from '../types';

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
  | { phase: 'preview'; fileName: string; parsed: LegacyParseResult; resolution: CustomerResolution }
  | { phase: 'importing'; progress: string }
  | { phase: 'done'; docCount: number; newCustomerCount: number; skippedCount: number }
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
      const existingCustomers = await api.customers.list();
      const resolution = resolveCustomers(parsed.rows, existingCustomers);
      setState({ phase: 'preview', fileName: file.name, parsed, resolution });
    } catch (err) {
      setState({ phase: 'error', message: `CSVの読み込みに失敗しました: ${(err as Error).message}` });
    }
  };

  const handleConfirm = async () => {
    if (state.phase !== 'preview') return;
    const { parsed, resolution } = state;
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
            {state.docCount}件の{label}を取り込みました(新規得意先{state.newCustomerCount}件を作成)。
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
    </div>
  );
}
