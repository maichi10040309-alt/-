import { api } from '../api/client';
import type { DocumentType } from '../types';

// 伝票番号をサーバー側で原子的に採番する(複数端末からの同時発行でも番号が重複しない)
export async function issueDocumentNumber(type: DocumentType, issueDate: string): Promise<string> {
  return api.documents.issueNumber(type, issueDate);
}
