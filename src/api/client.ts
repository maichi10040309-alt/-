import { http } from './http';
import type { Customer, Product, SalesDocument, CompanyInfo, DocumentType } from '../types';

function makeCollection<T extends { id: string }>(path: string) {
  return {
    list: () => http.get<T[]>(`/api/${path}`),
    get: (id: string) => http.get<T>(`/api/${path}/${id}`),
    put: (record: T) => http.put<T>(`/api/${path}/${record.id}`, record),
    patch: (id: string, patch: Partial<T>) => http.patch<T>(`/api/${path}/${id}`, patch),
    delete: (id: string) => http.del<{ ok: true }>(`/api/${path}/${id}`),
    bulkPut: (records: T[]) => http.post<{ count: number }>(`/api/${path}/bulk`, records),
  };
}

const customersCollection = makeCollection<Customer>('customers');
const productsCollection = makeCollection<Product>('products');
const documentsCollection = makeCollection<SalesDocument>('documents');

export const api = {
  customers: {
    ...customersCollection,
    count: () => http.get<{ count: number }>('/api/customers-count').then((r) => r.count),
    nextCode: () => http.post<{ code: string }>('/api/customers/next-code').then((r) => r.code),
    nextCodeBatch: (count: number) =>
      http.post<{ codes: string[] }>('/api/customers/next-code-batch', { count }).then((r) => r.codes),
  },
  products: {
    ...productsCollection,
    count: () => http.get<{ count: number }>('/api/products-count').then((r) => r.count),
    nextCode: () => http.post<{ code: string }>('/api/products/next-code').then((r) => r.code),
    nextCodeBatch: (count: number) =>
      http.post<{ codes: string[] }>('/api/products/next-code-batch', { count }).then((r) => r.codes),
  },
  documents: {
    ...documentsCollection,
    listByType: (type: DocumentType) =>
      http.get<SalesDocument[]>(`/api/documents?type=${encodeURIComponent(type)}`),
    issueNumber: (type: DocumentType, issueDate: string) =>
      http.post<{ number: string }>('/api/documents/issue-number', { type, issueDate }).then((r) => r.number),
  },
  company: {
    get: () => http.get<CompanyInfo>('/api/company'),
    put: (record: CompanyInfo) => http.put<CompanyInfo>('/api/company', record),
    patch: (patch: Partial<CompanyInfo>) => http.patch<CompanyInfo>('/api/company', patch),
  },
  backup: {
    export: () => http.get<Record<string, unknown>>('/api/backup'),
    import: (data: unknown) => http.post<{ ok: true }>('/api/restore', data),
  },
};
