import type { Customer, Product } from '../types';

// 得意先の単価ランク・掛率を適用した単価を算出する
export function resolveUnitPrice(product: Product, customer: Customer | undefined): number {
  const base =
    customer?.priceTier === 2
      ? product.prices.price2
      : customer?.priceTier === 3
        ? product.prices.price3
        : product.prices.price1;
  const rate = customer?.discountRate ?? 100;
  return Math.round(base * (rate / 100));
}
