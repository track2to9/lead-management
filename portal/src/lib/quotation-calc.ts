import type { QuotationItem, ExtraCost } from "./types";

export function convertCurrency(
  amount: number,
  fromCurrency: string,
  rates: Record<string, number>,
): number {
  const rate = rates[fromCurrency];
  if (!rate || rate === 0) return amount;
  return amount / rate;
}

function sumExtraCosts(costs: ExtraCost[], rates: Record<string, number>): number {
  return costs.reduce((sum, c) => sum + convertCurrency(c.amount, c.currency, rates), 0);
}

export function calcForward(
  costPrice: number,
  costCurrency: string,
  marginPercent: number,
  extraCosts: ExtraCost[],
  rates: Record<string, number>,
): { sellingPrice: number; marginAmount: number; costUSD: number } {
  const costUSD = convertCurrency(costPrice, costCurrency, rates);
  const extras = sumExtraCosts(extraCosts, rates);
  const totalCost = costUSD + extras;
  const sellingPrice = totalCost * (1 + marginPercent / 100);
  const marginAmount = sellingPrice - totalCost;
  return {
    sellingPrice: Math.round(sellingPrice * 100) / 100,
    marginAmount: Math.round(marginAmount * 100) / 100,
    costUSD: Math.round(costUSD * 100) / 100,
  };
}

export function calcReverse(
  sellingPrice: number,
  costPrice: number,
  costCurrency: string,
  extraCosts: ExtraCost[],
  rates: Record<string, number>,
): { marginPercent: number; marginAmount: number; costUSD: number } {
  const costUSD = convertCurrency(costPrice, costCurrency, rates);
  const extras = sumExtraCosts(extraCosts, rates);
  const totalCost = costUSD + extras;
  const marginAmount = sellingPrice - totalCost;
  const marginPercent = totalCost > 0 ? (marginAmount / totalCost) * 100 : 0;
  return {
    marginPercent: Math.round(marginPercent * 10) / 10,
    marginAmount: Math.round(marginAmount * 100) / 100,
    costUSD: Math.round(costUSD * 100) / 100,
  };
}

export function calcSummary(
  items: QuotationItem[],
  globalCosts: ExtraCost[],
  rates: Record<string, number>,
): { totalCost: number; totalExtraCosts: number; totalSelling: number; totalMargin: number; marginPercent: number } {
  const totalCost = items.reduce(
    (sum, item) => sum + convertCurrency(item.cost_price || 0, item.cost_currency, rates), 0,
  );
  const itemExtras = items.reduce(
    (sum, item) => sum + sumExtraCosts(item.extra_costs || [], rates), 0,
  );
  const globalExtrasTotal = sumExtraCosts(globalCosts, rates);
  const totalExtraCosts = itemExtras + globalExtrasTotal;
  const totalSelling = items.reduce((sum, item) => sum + (item.selling_price || 0), 0);
  const totalMargin = totalSelling - totalCost - totalExtraCosts;
  const marginPercent = totalCost + totalExtraCosts > 0 ? (totalMargin / (totalCost + totalExtraCosts)) * 100 : 0;
  return {
    totalCost: Math.round(totalCost * 100) / 100,
    totalExtraCosts: Math.round(totalExtraCosts * 100) / 100,
    totalSelling: Math.round(totalSelling * 100) / 100,
    totalMargin: Math.round(totalMargin * 100) / 100,
    marginPercent: Math.round(marginPercent * 10) / 10,
  };
}

export function formatCurrency(value: number, currency: string = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}
