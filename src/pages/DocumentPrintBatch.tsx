import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import type { CompanyInfo, Customer, DocumentType, SalesDocument } from '../types';
import { DOCUMENT_TYPE_LABEL } from '../types';
import DocumentPrintSheet from '../components/DocumentPrintSheet';
import DeliveryNotePrint from '../components/DeliveryNotePrint';
import ConsolidatedInvoicePrint from '../components/ConsolidatedInvoicePrint';
import { getPaperCss } from '../utils/printPaper';

export default function DocumentPrintBatch() {
  const { type } = useParams<{ type: DocumentType }>();
  const docType = type as DocumentType;
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const idsParam = searchParams.get('ids') ?? '';
  const ids = idsParam ? idsParam.split(',') : [];

  const [company, setCompany] = useState<CompanyInfo | null>(null);
  const [docs, setDocs] = useState<SalesDocument[] | null>(null);
  const [customerMap, setCustomerMap] = useState<Map<string, Customer>>(new Map());

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.company.get(),
      Promise.all(ids.map((id) => api.documents.get(id).catch(() => null))),
      api.customers.list(),
    ]).then(([companyData, docResults, customers]) => {
      if (cancelled) return;
      setCompany(companyData);
      setDocs(docResults.filter((d): d is SalesDocument => d !== null));
      setCustomerMap(new Map(customers.map((c) => [c.id, c])));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsParam]);

  const label = DOCUMENT_TYPE_LABEL[docType] ?? '伝票';
  const pageCss = getPaperCss(docType);

  if (!company || !docs) return <div className="card">読み込み中...</div>;

  if (docs.length === 0) {
    return (
      <div>
        <div className="print-toolbar no-print">
          <button className="btn btn-secondary" onClick={() => navigate(-1)}>
            戻る
          </button>
        </div>
        <div className="card">印刷対象の{label}が見つかりませんでした。</div>
      </div>
    );
  }

  return (
    <div>
      {pageCss && <style>{pageCss}</style>}
      <div className="print-toolbar no-print">
        <button className="btn btn-secondary" onClick={() => navigate(-1)}>
          戻る
        </button>
        <button className="btn btn-primary" onClick={() => window.print()}>
          {docs.length}件をまとめて印刷 / PDF出力
        </button>
      </div>

      {docs.map((doc) => (
        <div className="print-batch-item" key={doc.id}>
          {docType === 'delivery' ? (
            <DeliveryNotePrint doc={doc} customer={customerMap.get(doc.customerId)} company={company} />
          ) : docType === 'consolidated_invoice' ? (
            <ConsolidatedInvoicePrint doc={doc} customer={customerMap.get(doc.customerId)} company={company} />
          ) : (
            <DocumentPrintSheet doc={doc} customer={customerMap.get(doc.customerId)} company={company} docType={docType} />
          )}
        </div>
      ))}
    </div>
  );
}
