import { Activity, X } from 'lucide-react';
import type { Trade } from '@/lib/types';
import { money, points, shortDate, getToneClass, calculateAveragePoints, sortTradesForTable } from '@/lib/calc';

type Props = { strategy: string; trades: Trade[]; onClose: () => void; onViewTrade: (t: Trade) => void };

export default function StrategyDetailModal({ strategy, trades, onClose, onViewTrade }: Props) {
  const items = trades.filter(t => t.strategy === strategy);
  const result = items.reduce((s, t) => s + t.result, 0);
  const wins = items.filter(t => t.result > 0).length;
  const losses = items.filter(t => t.result < 0).length;
  const bes = items.filter(t => t.result === 0).length;
  const winRate = items.length ? (wins / items.length) * 100 : 0;
  const avgResult = items.length ? result / items.length : 0;
  const avgWin = wins ? items.filter(t => t.result > 0).reduce((s, t) => s + t.result, 0) / wins : 0;
  const avgLoss = losses ? items.filter(t => t.result < 0).reduce((s, t) => s + t.result, 0) / losses : 0;
  const sorted = sortTradesForTable(items);
  const stratEquity: number[] = [];
  let run = 0;
  for (const t of items) { run += t.result; stratEquity.push(run); }
  const maxE = Math.max(...stratEquity, 0);
  const minE = Math.min(...stratEquity, 0);
  const rangeE = maxE - minE || 1;
  const W = 100; const H = 40;
  const sparkPts = stratEquity.map((v, i) => `${(i / Math.max(stratEquity.length - 1, 1)) * W},${H - ((v - minE) / rangeE) * H}`).join(' ');

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="strat-modal">
        <div className="tdet-header">
          <div>
            <div className="eyebrow"><span className="green-dot" /> PERFORMANCE POR ESTRATÉGIA</div>
            <h2>{strategy}</h2>
          </div>
          <button className="icon-button" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="strat-summary">
          <div className={`strat-kpi strat-kpi-main ${result >= 0 ? 'kpi-pos' : 'kpi-neg'}`}><span>Resultado total</span><strong>{money(result)}</strong></div>
          <div className="strat-kpi"><span>Win Rate</span><strong style={{ color: '#00e6a0' }}>{winRate.toFixed(1)}%</strong></div>
          <div className="strat-kpi"><span>Operações</span><strong>{items.length}</strong></div>
          <div className="strat-kpi"><span>Média/op</span><strong className={getToneClass(avgResult)}>{money(avgResult)}</strong></div>
          <div className="strat-kpi"><span>W / L / BE</span><strong><span style={{ color: '#00e6a0' }}>{wins}</span> / <span style={{ color: '#fb6376' }}>{losses}</span> / <span style={{ color: '#8a9e97' }}>{bes}</span></strong></div>
          <div className="strat-kpi"><span>Média venc.</span><strong style={{ color: '#00e6a0' }}>{money(avgWin)}</strong></div>
          <div className="strat-kpi"><span>Média perd.</span><strong style={{ color: '#fb6376' }}>{money(avgLoss)}</strong></div>
        </div>
        {stratEquity.length > 1 && (
          <div className="strat-spark-wrap">
            <span className="tdet-section-title">Curva de Capital desta Estratégia</span>
            <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="strat-spark">
              <defs>
                <linearGradient id="sg" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor={result >= 0 ? '#00e6a0' : '#fb6376'} stopOpacity=".3" />
                  <stop offset="100%" stopColor={result >= 0 ? '#00e6a0' : '#fb6376'} stopOpacity="0" />
                </linearGradient>
              </defs>
              <polygon points={`0,${H} ${sparkPts} ${W},${H}`} fill="url(#sg)" />
              <polyline points={sparkPts} fill="none" stroke={result >= 0 ? '#00e6a0' : '#fb6376'} strokeWidth="2" vectorEffect="non-scaling-stroke" />
            </svg>
          </div>
        )}
        <div className="tdet-section-title" style={{ marginBottom: 10 }}>Operações ({sorted.length})</div>
        {items.length === 0 ? (
          <div className="tdet-empty-note"><Activity size={24} /><p>Nenhuma operação registrada para esta estratégia.</p></div>
        ) : (
          <div className="strat-trades-list">
            {sorted.map(t => (
              <div key={t.id} className="strat-trade-row" onClick={() => onViewTrade(t)} style={{ cursor: 'pointer' }}>
                <div className="strat-trade-left">
                  <span className="strat-trade-date">{shortDate(t.date)}</span>
                  <span className="asset-pill">{t.asset}</span>
                  <span className="strat-trade-info">{t.contracts} cts</span>
                </div>
                <div className="strat-trade-right">
                  <span className={`${getToneClass(calculateAveragePoints(t))} mono`}>{points(calculateAveragePoints(t))}</span>
                  <span className={`${getToneClass(t.result)} mono strong`}>{money(t.result)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
