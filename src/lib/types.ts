export type Trade = {
  id: number;
  date: string;
  asset: string;
  strategy: string;
  contracts: number;
  points: number;
  result: number;
  stopLoss?: number;
  partials?: PartialExecution[];
  hadPartial?: boolean;
  partialPoints?: number;
  partialContracts?: number;
  hadAddition?: boolean;
  additionPoints?: number;
  additionContracts?: number;
  note: string;
  details?: TradeDetails;
};

export type PartialExecution = { points: number; contracts: number };

export type TradeDetails = {
  account?: string;
  entryTime?: string;
  exitTime?: string;
  direction?: 'Compra' | 'Venda';
  mandatoryRules?: Record<string, boolean>;
  qualityFilters?: Record<string, boolean>;
  emotion?: string;
  imageUrl?: string;
  initialContracts?: number;
  assumedStop?: number;
  mfe?: number;
  mae?: number;
  marketContext?: string;
};

export type Note = { id: number; date: string; title: string; body: string; tag: string };
