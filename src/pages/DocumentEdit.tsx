import { useEffect, useState } from 'react';
import { useLiveQuery } from '../api/useLiveQuery';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import PageHeader from '../components/PageHeader';
import ItemsEditor from '../components/ItemsEditor';
import TotalsBox from '../components/TotalsBox';
import { newId } from '../utils/id';
import { todayISO, addDays } from '../utils/format';
import { calcDocumentTotals } from '../utils/tax';
import { issueDocumentNumber } from '../utils/docNumber';
import { DOCUMENT_TYPE_LABEL, type DocumentType, type SalesDocument } from '../types';

const emptyDoc = (type: DocumentType): SalesDocument => {
  const now = new Date().toISOString();
  const issueDate = todayISO();
  return {
    id: newId(),
    type,
    number: '(未発行)',
    customerId: '',
    issueDate,
    validUntilDate: addDays(issueDate, 30),
    dueDate: addDays(issueDate, 30),
    title: '',
    items: [],
    notes: '',
    status: 'draft',
    sourceDocumentIds: [],
    convertedToDocumentId: null,
    periodFrom: '',
    periodTo: '',
    previousBalance: 0,
    paymentsAmount: 0,
    deliveryTag: '',
    paid: false,
    paidDate: '',
    bankFee: 0,
    sourceSummaries: [],
    createdAt: now,
    updatedAt: now,
  };
};

export default function DocumentEdit() {
  const { type, id } = useParams<{ type: DocumentType; id: string }>();
  const docType = type as DocumentType;
  const isNew = id === 'new';
  const navigate = useNavigate();

  const company = useLiveQuery(() => api.company.get(), []);
  const customers = useLiveQuery(() => api.customers.list(), []);
  const products = useLiveQuery(() => api.products.list(), []);

  const [doc, setDoc] = useState<SalesDocument>(emptyDoc(docType));
  const [loaded, setLoaded] = useState(isNew);

  useEffect(() => {
    if (isNew) {
      setDoc(emptyDoc(docType));
      setLoaded(true);
      return;
    }
    api.documents
      .get(id!)
      .then((d) =>
        setDoc(
          d
            ? {
                ...d,
                deliveryTag: d.deliveryTag ?? '',
                paid: d.paid ?? false,
                paidDate: d.paidDate ?? '',
                bankFee: d.bankFee ?? 0,
                sourceSummaries: d.sourceSummaries ?? [],
              }
            : d,
        ),
      )
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [id, isNew, docType]);

  const set = <K extends keyof SalesDocument>(key: K, value: SalesDocument[K]) =>
    setDoc((d) => ({ ...d, [key]: value }));

  const customer = customers?.find((c) => c.id === doc.customerId);
  const totals = calcDocumentTotals(doc.items, company?.taxRounding ?? 'floor');

  const handleSave = async (issue: boolean) => {
    if (!doc.customerId) {
      alert('得意先を選択してください。');
      return;
    }
    const now = new Date().toISOString();
    let toSave = { ...doc, updatedAt: now };
    if (issue && (toSave.status === 'draft' || toSave.number === '(未発行)')) {
      toSave.number = await issueDocumentNumber(docType, toSave.issueDate);
      toSave.status = 'issued';
    }
    await api.documents.put(toSave);
    setDoc(toSave);
    navigate(`/documents/${docType}`);
  };

  const handleDelete = async () => {
    if (!confirm('この伝票を削除しますか?')) return;
    await api.documents.delete(doc.id);
    navigate(`/documents/${docType}`);
  };

  const convertTo = async (targetType: DocumentType) => {
    if (doc.status === 'draft') {
      alert('先に保存・発行してから変換してください。');
      return;
    }
    const now = new Date().toISOString();
    const issueDate = todayISO();
    const number = await issueDocumentNumber(targetType, issueDate);
    const newDoc: SalesDocument = {
      ...emptyDoc(targetType),
      id: newId(),
      number,
      customerId: doc.customerId,
      issueDate,
      dueDate: addDays(issueDate, 30),
      title: doc.title,
      items: doc.items.map((it) => ({ ...it, id: newId() })),
      notes: doc.notes,
      status: 'issued',
      sourceDocumentIds: [doc.id],
      createdAt: now,
      updatedAt: now,
    };
    await api.documents.put(newDoc);
    await api.documents.patch(doc.id, { status: 'converted', convertedToDocumentId: newDoc.id, updatedAt: now });
    navigate(`/documents/${targetType}/${newDoc.id}`);
  };

  if (!loaded) return <div className="card">読み込み中...</div>;

  const label = DOCUMENT_TYPE_LABEL[docType];
  const canConvertToDelivery = docType === 'quotation' && doc.status === 'issued';
  const canConvertToInvoice = docType === 'delivery' && doc.status === 'issued';
  const canConvertToReceipt = docType === 'invoice' && doc.status === 'issued';

  return (
    <div>
      <PageHeader
        title={isNew ? `${label}の新規作成` : `${label} ${doc.number}`}
        subtitle={doc.status === 'converted' ? '他の伝票に変換済みです' : undefined}
        actions={
          <>
            {!isNew && (
              <button className="btn btn-danger" onClick={handleDelete}>
                削除
              </button>
            )}
            {canConvertToDelivery && (
              <button className="btn btn-secondary" onClick={() => convertTo('delivery')}>
                納品書に変換
              </button>
            )}
            {canConvertToInvoice && (
              <button className="btn btn-secondary" onClick={() => convertTo('invoice')}>
                請求書に変換
              </button>
            )}
            {canConvertToReceipt && (
              <button className="btn btn-secondary" onClick={() => convertTo('receipt')}>
                領収証を発行
              </button>
            )}
            {!isNew && (
              <button className="btn btn-secondary" onClick={() => navigate(`/documents/${docType}/${doc.id}/print`)}>
                印刷プレビュー
              </button>
            )}
            <button className="btn btn-secondary" onClick={() => navigate(`/documents/${docType}`)}>
              一覧へ戻る
            </button>
            <button className="btn btn-secondary" onClick={() => handleSave(false)}>
              下書き保存
            </button>
            <button className="btn btn-primary" onClick={() => handleSave(true)}>
              発行して保存
            </button>
          </>
        }
      />

      <div className="card form-grid">
        <label>
          得意先 *
          <select value={doc.customerId} onChange={(e) => set('customerId', e.target.value)}>
            <option value="">選択してください</option>
            {customers?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          発行日
          <input type="date" value={doc.issueDate} onChange={(e) => set('issueDate', e.target.value)} />
        </label>
        {docType === 'quotation' && (
          <label>
            有効期限
            <input type="date" value={doc.validUntilDate} onChange={(e) => set('validUntilDate', e.target.value)} />
          </label>
        )}
        {(docType === 'invoice' || docType === 'consolidated_invoice') && (
          <label>
            お支払期限
            <input type="date" value={doc.dueDate} onChange={(e) => set('dueDate', e.target.value)} />
          </label>
        )}
        {docType === 'delivery' && (
          <label>
            配送区分
            <select value={doc.deliveryTag} onChange={(e) => set('deliveryTag', e.target.value)}>
              <option value="">(未設定)</option>
              {company?.deliveryTagOptions?.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </label>
        )}
        {docType !== 'quotation' && (
          <label className="paid-check-label">
            <input type="checkbox" checked={doc.paid} onChange={(e) => set('paid', e.target.checked)} />
            入金済み
            {doc.paid && (
              <input
                type="date"
                className="paid-date-input"
                value={doc.paidDate}
                onChange={(e) => set('paidDate', e.target.value)}
              />
            )}
          </label>
        )}
        <label className="col-span-2">
          件名
          <input value={doc.title} onChange={(e) => set('title', e.target.value)} placeholder="例: ○○商品一式" />
        </label>
      </div>

      <div className="card">
        <ItemsEditor items={doc.items} onChange={(items) => set('items', items)} products={products ?? []} customer={customer} />
      </div>

      <div className="card two-col">
        <label className="notes-field">
          備考
          <textarea value={doc.notes} onChange={(e) => set('notes', e.target.value)} rows={5} />
        </label>
        <TotalsBox totals={totals} />
      </div>
    </div>
  );
}
