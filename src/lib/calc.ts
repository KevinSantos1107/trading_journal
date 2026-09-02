import type { Trade } from './types';

export const POINT_VALUE: Record<string, number> = {
  'Mini Índice': 0.20,
  'Mini Dólar': 10.00,
};

export const ASSET_OPTIONS = ['Mini Índice', 'Mini Dólar'];

export const STRATEGIES = [
  'Trade de Abertura com Notícia',
  'Trade de Abertura sem Notícia',
  'Extremidade a Favor da Tendência',
  'Extremidade Contra a Tendência',
];

export function calculateResult(trade: Pick<Trade, 'asset' | 'contracts' | 'points' | 'partials' | 'hadPartial' | 'partialPoints' | 'partialContracts' | 'hadAddition' | 'additionPoints' | 'additionContracts'>): number {
  const pointValue = POINT_VALUE[trade.asset] ?? 0.20;
  let result = trade.points * pointValue * trade.contracts;
  const partials = trade.partials ?? (trade.hadPartial && trade.partialPoints != null && trade.partialContracts != null
    ? [{ points: trade.partialPoints, contracts: trade.partialContracts }]
    : []);

  for (const partial of partials) {
    result += partial.points * pointValue * partial.contracts;
  }

  if (trade.hadAddition && trade.additionPoints != null && trade.additionContracts != null) {
    result += trade.additionPoints * pointValue * trade.additionContracts;
  }

  return Math.round(result * 100) / 100;
}

export function calculateStopLoss(asset: string, stopLossPoints: number, contracts: number): number {
  const pointValue = POINT_VALUE[asset] ?? 0.20;
  return Math.round(Math.abs(stopLossPoints) * pointValue * contracts * 100) / 100;
}

export const getToneClass = (value: number) => {
  if (value > 0) return 'positive';
  if (value < 0) return 'negative';
  return 'neutral';
};

export const money = (value: number) =>
  `${value > 0 ? '+' : value < 0 ? '-' : ''}R$ ${Math.abs(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const moneyShort = (value: number) => {
  const abs = Math.abs(value);
  if (abs >= 1000) return `${value >= 0 ? '+' : '-'}R$ ${(abs / 1000).toFixed(1)}k`;
  return money(value);
};

export const points = (value: number) =>
  `${value > 0 ? '+' : value < 0 ? '-' : ''}${Math.abs(value).toLocaleString('pt-BR')} pts`;

export function calculateAveragePoints(trade: Trade): number {
  const pointValue = POINT_VALUE[trade.asset] ?? 0.20;
  const result = trade.result;
  const totalContracts = Number(trade.contracts) + (trade.partials ?? []).reduce((sum, item) => sum + Number(item.contracts || 0), 0);
  if (!totalContracts) return 0;
  return Math.round(result / pointValue / totalContracts);
}

export const shortDate = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');

export const fullDate = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

export type Stats = {
  totalResult: number;
  totalPoints: number;
  wins: number;
  losses: number;
  breakeven: number;
  winRate: number;
  tradingDays: number;
  maxDrawdown: number;
  peak: number;
  winnersAverage: number;
  losersAverage: number;
  riskReward: number;
  profitFactor: number;
  totalTrades: number;
};

export function calculateStats(trades: Trade[]): Stats {
  const totalResult = trades.reduce((sum, t) => sum + t.result, 0);
  const totalPoints = trades.reduce((sum, t) => sum + t.points, 0);
  const wins = trades.filter((t) => t.result > 0).length;
  const losses = trades.filter((t) => t.result < 0).length;
  const breakeven = trades.length - wins - losses;
  const winRate = trades.length ? (wins / trades.length) * 100 : 0;
  const tradingDays = new Set(trades.map((t) => t.date)).size;

  let peak = 0;
  let equity = 0;
  let maxDrawdown = 0;
  for (const trade of trades) {
    equity += trade.result;
    if (equity > peak) peak = equity;
    const dd = equity - peak;
    if (dd < maxDrawdown) maxDrawdown = dd;
  }

  const winnersAverage = wins ? trades.filter((t) => t.result > 0).reduce((s, t) => s + t.result, 0) / wins : 0;
  const losersAverage = losses ? trades.filter((t) => t.result < 0).reduce((s, t) => s + t.result, 0) / losses : 0;
  const riskReward = losersAverage ? Math.abs(winnersAverage / losersAverage) : 0;
  const grossProfit = trades.filter((t) => t.result > 0).reduce((s, t) => s + t.result, 0);
  const grossLoss = Math.abs(trades.filter((t) => t.result < 0).reduce((s, t) => s + t.result, 0));
  const profitFactor = grossLoss ? grossProfit / grossLoss : 0;

  return {
    totalResult, totalPoints, wins, losses, breakeven, winRate, tradingDays,
    maxDrawdown, peak, winnersAverage, losersAverage, riskReward, profitFactor,
    totalTrades: trades.length,
  };
}
