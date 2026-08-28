import { useLiveQuery } from '../api/useLiveQuery';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { DocumentType } from '../types';
import DocumentPrintSheet from '../components/DocumentPrintSheet';
import { getPaperCss } from '../utils/printPaper';

export default function DocumentPrint() {
  const { type, id } = useParams<{ type: DocumentType; id: string }>();
  const docType = type as DocumentType;
  const navigate = useNavigate();

  const company = useLiveQuery(() => api.company.get(), []);
  const doc = useLiveQuery(() => api.documents.get(id!), [id]);
  const customer = useLiveQuery(
    () => (doc ? api.customers.get(doc.customerId) : Promise.resolve(undefined)),
    [doc],
  );

  if (!doc || !company) return <div className="card">読み込み中...</div>;

  const pageCss = getPaperCss(docType);

  return (
    <div>
      {pageCss && <style>{pageCss}</style>}
      <div className="print-toolbar no-print">
        <button className="btn btn-secondary" onClick={() => navigate(-1)}>
          戻る
        </button>
        <button className="btn btn-primary" onClick={() => window.print()}>
          印刷 / PDF出力
        </button>
      </div>

      <DocumentPrintSheet doc={doc} customer={customer} company={company} docType={docType} />
    </div>
  );
}
