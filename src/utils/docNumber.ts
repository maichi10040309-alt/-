import { db } from '../db/db';
import type { DocumentType } from '../types';
import { DOCUMENT_TYPE_PREFIX } from '../types';

// 伝票番号を採番して company.nextDocNumber をインクリメントする
export async function issueDocumentNumber(type: DocumentType, issueDate: string): Promise<string> {
  const company = await db.company.get(1);
  const year = issueDate.slice(0, 4);
  const current = company?.nextDocNumber?.[type] ?? 1;
  const next = current + 1;

  if (company) {
    await db.company.update(1, {
      nextDocNumber: { ...company.nextDocNumber, [type]: next },
    });
  }

  const prefix = DOCUMENT_TYPE_PREFIX[type];
  return `${prefix}-${year}-${String(current).padStart(4, '0')}`;
}
