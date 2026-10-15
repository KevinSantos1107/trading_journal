import type { Trade, AssetConfig } from './types';

export const STRATEGIES = [
  'Trade de Abertura com Notícia',
  'Trade de Abertura sem Notícia',
  'Extremidade a Favor da Tendência',
  'Extremidade Contra a Tendência',
];

export function calculateResult(trade: Pick<Trade, 'contracts' | 'points' | 'partials' | 'hadPartial' | 'partialPoints' | 'partialContracts' | 'hadAddition' | 'additionPoints' | 'additionContracts'>, pointValue: number): number {
  const partials = trade.partials ?? (trade.hadPartial && trade.partialPoints != null && trade.partialContracts != null
    ? [{ points: trade.partialPoints, contracts: trade.partialContracts }]
    : []);

  let result = 0;
  if (partials.length > 0) {
    for (const partial of partials) {
      result += partial.points * pointValue * partial.contracts;
    }
  } else {
    result = trade.points * pointValue * trade.contracts;
  }

  if (trade.hadAddition && trade.additionPoints != null && trade.additionContracts != null) {
    result += trade.additionPoints * pointValue * trade.additionContracts;
  }

  return Math.round(result * 100) / 100;
}

export function calculateStopLoss(stopLossPoints: number, contracts: number, pointValue: number): number {
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
  const partials = trade.partials ?? (trade.hadPartial && trade.partialPoints != null && trade.partialContracts != null
    ? [{ points: trade.partialPoints, contracts: trade.partialContracts }]
    : []);
  
  if (partials.length > 0) {
    let totalPoints = 0;
    let exitCount = 0;
    for (const p of partials) {
      if (Number(p.contracts) > 0 || Number(p.points) !== 0) {
        totalPoints += Number(p.points || 0);
        exitCount += 1;
      }
    }
    return exitCount ? Math.round(totalPoints / exitCount) : 0;
  }

  return Math.round(Number(trade.points || 0));
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
  const totalPoints = trades.reduce((sum, t) => sum + calculateAveragePoints(t), 0);
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

// ── Ordenação de operações ──────────────────────────────────────────────────

// 1. Ordem puramente cronológica (mais antiga para mais nova):
// Usada em cálculos de equity, drawdown e histórico
export function sortTradesChrono(trades: Trade[]): Trade[] {
  return [...trades].sort((a, b) => {
    // 1. Data (crescente)
    const dateDiff = a.date.localeCompare(b.date);
    if (dateDiff !== 0) return dateDiff;

    // 2. Horário de entrada (se ambos tiverem, quem foi realizada primeiro vem antes)
    const timeA = a.details?.entryTime || '';
    const timeB = b.details?.entryTime || '';
    if (timeA && timeB) {
      const timeDiff = timeA.localeCompare(timeB);
      if (timeDiff !== 0) return timeDiff;
    } else if (timeA && !timeB) {
      return -1;
    } else if (!timeA && timeB) {
      return 1;
    }

    // 3. Caso não tenha horário, mantém a ordem que o usuário adicionou (id crescente)
    return (a.id || 0) - (b.id || 0);
  });
}

// 2. Ordem para tabelas e listagens visuais:
// - Dias mais recentes no topo (b.date.localeCompare(a.date))
// - Dentro do mesmo dia: a operação realizada depois fica em cima, e a que aconteceu primeiro fica em baixo (horário decrescente)
export function sortTradesForTable(trades: Trade[]): Trade[] {
  return [...trades].sort((a, b) => {
    // 1. Data mais recente no topo
    const dateDiff = b.date.localeCompare(a.date);
    if (dateDiff !== 0) return dateDiff;

    // 2. No mesmo dia: quem foi realizada depois fica em cima (horário decrescente)
    const timeA = a.details?.entryTime || '';
    const timeB = b.details?.entryTime || '';
    if (timeA && timeB) {
      const timeDiff = timeB.localeCompare(timeA);
      if (timeDiff !== 0) return timeDiff;
    } else if (timeA && !timeB) {
      return -1;
    } else if (!timeA && timeB) {
      return 1;
    }

    // 3. Caso não tenha horário, mantém a ordem inversa de adição (último adicionado em cima)
    return (b.id || 0) - (a.id || 0);
  });
}

export type PeriodFilterMode = 'today' | 'week' | 'month' | 'all' | 'custom';

// Filtro unificado de período utilizado no Dashboard e na Sidebar de Contas
export function filterTradesByPeriod(
  trades: Trade[],
  filterMode: PeriodFilterMode,
  customStartDate?: string,
  customEndDate?: string
): Trade[] {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const todayStr = `${year}-${month}-${day}`;

  if (filterMode === 'all') return trades;
  if (filterMode === 'today') return trades.filter(t => t.date === todayStr);
  if (filterMode === 'week') {
    const dayOfWeek = now.getDay();
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = new Date(now);
    monday.setDate(now.getDate() - diffToMonday);
    const mYear = monday.getFullYear();
    const mMonth = String(monday.getMonth() + 1).padStart(2, '0');
    const mDay = String(monday.getDate()).padStart(2, '0');
    const weekStr = `${mYear}-${mMonth}-${mDay}`;
    return trades.filter(t => t.date >= weekStr && t.date <= todayStr);
  }
  if (filterMode === 'month') {
    const monthStr = `${year}-${month}-01`;
    return trades.filter(t => t.date >= monthStr && t.date <= todayStr);
  }
  if (filterMode === 'custom') {
    return trades.filter(t => {
      if (customStartDate && t.date < customStartDate) return false;
      if (customEndDate && t.date > customEndDate) return false;
      return true;
    });
  }
  return trades;
}

// ── Correspondência inteligente de ativos (ex: MGCFUT -> MGC, WINV26 -> Mini Índice) ─
export function matchAsset(rawName: string | undefined, assets: AssetConfig[]): AssetConfig | undefined {
  if (!rawName || !assets.length) return undefined;
  const raw = rawName.trim().toUpperCase();

  // 1. Correspondência exata (case-insensitive)
  const exact = assets.find(a => a.name.trim().toUpperCase() === raw);
  if (exact) return exact;

  // 2. Se o nome cadastrado começa com o código do ativo ou vice-versa (ex: "MGCFUT" e "MGC")
  const prefixMatch = assets.find(a => {
    const aName = a.name.trim().toUpperCase();
    return raw.startsWith(aName) || aName.startsWith(raw);
  });
  if (prefixMatch) return prefixMatch;

  // 3. Regra das 3 primeiras letras iguais (ex: MGCFUT e MGC compartilham "MGC")
  if (raw.length >= 3) {
    const raw3 = raw.substring(0, 3);
    const threeLetterMatch = assets.find(a => {
      const a3 = a.name.trim().substring(0, 3).toUpperCase();
      return a3.length >= 3 && a3 === raw3;
    });
    if (threeLetterMatch) return threeLetterMatch;
  }

  // 4. Mapeamentos padrão B3 (WIN -> Mini Índice, WDO -> Mini Dólar, etc.)
  if (raw.startsWith('WIN')) {
    const win = assets.find(a => a.name.toLowerCase().includes('índice') || a.name.toLowerCase().includes('indice') || a.name.toUpperCase().includes('WIN'));
    if (win) return win;
  }
  if (raw.startsWith('WDO')) {
    const wdo = assets.find(a => a.name.toLowerCase().includes('dólar') || a.name.toLowerCase().includes('dolar') || a.name.toUpperCase().includes('WDO'));
    if (wdo) return wdo;
  }
  if (raw.startsWith('IND')) {
    const ind = assets.find(a => a.name.toLowerCase().includes('índice cheio') || a.name.toUpperCase().includes('IND'));
    if (ind) return ind;
  }
  if (raw.startsWith('DOL')) {
    const dol = assets.find(a => a.name.toLowerCase().includes('dólar cheio') || a.name.toUpperCase().includes('DOL'));
    if (dol) return dol;
  }

  return undefined;
}

