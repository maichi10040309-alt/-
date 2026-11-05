import type { Client } from '@/types';

export type CustomerSort = 'default' | 'asc' | 'desc';
const numberOrder = new Intl.Collator('ja', { numeric: true });
const nameOrder = new Intl.Collator('ja');

export function compareCustomerNumbers(a: Client | undefined, b: Client | undefined, order: CustomerSort): number {
  if (order === 'default') return 0;
  const left = a?.customerNumber?.trim() || '';
  const right = b?.customerNumber?.trim() || '';
  if (Boolean(left) !== Boolean(right)) return left ? -1 : 1;
  const number = numberOrder.compare(left, right);
  if (number) return order === 'desc' ? -number : number;
  return nameOrder.compare(a?.kana || a?.name || '', b?.kana || b?.name || '') ||
    nameOrder.compare(a?.name || '', b?.name || '');
}

export function customerSortOptions(order: CustomerSort, defaultLabel: string): string {
  return `<option value="default"${order === 'default' ? ' selected' : ''}>${defaultLabel}</option>
    <option value="asc"${order === 'asc' ? ' selected' : ''}>セディナ番号の小さい順</option>
    <option value="desc"${order === 'desc' ? ' selected' : ''}>セディナ番号の大きい順</option>`;
}
