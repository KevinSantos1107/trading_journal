import { useEffect, useMemo, useState } from 'react';
import { Upload,
  Activity, CalendarDays, Edit3, Filter, MoreHorizontal, Plus,
  PlusCircle, Target, Trash2, TrendingDown, TrendingUp, Zap,
  ArrowRight, Flame, Scissors,
} from 'lucide-react';
import DiarySummary from '@/components/DiarySummary';
import type { Trade } from '@/lib/types';
import type { OperationalConfig } from '@/lib/types';
import { STRATEGIES, money, points, shortDate, calculateStats, getToneClass, calculateAveragePoints, sortTradesForTable } from '@/lib/calc';
import DayCalendarModal from '@/components/modals/DayCalendarModal';
import TradeDetailModal from '@/components/modals/TradeDetailModal';
import StrategyDetailModal from '@/components/modals/StrategyDetailModal';

// ─── UI Atoms ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, meta, icon, tone, chart, onClick }: { label: string; value: string; meta: React.ReactNode; icon: React.ReactNode; tone: string; chart?: React.ReactNode; onClick?: () => void }) {
  return (
    <div
      className={`stat-card tone-${tone}${onClick ? ' stat-card-clickable' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
    >
      <div className="stat-label">{icon}<span>{label}</span>{onClick && <span className="clickable-hint">clique para ver</span>}</div>
      <strong className="stat-value">{value}</strong>
      <span className="stat-meta">{meta}</span>
      {chart && <div className="stat-chart">{chart}</div>}
    </div>
  );
}
function MetricCard({ label, value, hint, tone }: { label: string; value: string; hint: string; tone: string }) {
  return <div className={`metric-card tone-${tone}`}><span>{label}</span><strong>{value}</strong><small>{hint}</small></div>;
}
function ChartCard({ title, subtitle, children, className = '' }: { title: string; subtitle: string; children: React.ReactNode; className?: string }) {
  return <div className={`chart-card ${className}`}><div className="chart-header"><div><h3>{title}</h3><span>{subtitle}</span></div><button><MoreHorizontal size={17} /></button></div>{children}</div>;
}
function SectionHeading({ title, action }: { title: string; action?: string }) {
  return <div className="section-heading"><h2>{title}</h2>{action && <button>{action} <ArrowRight size={14} /></button>}</div>;
}
function Ring({ value }: { value: number }) {
  return <div className="ring" style={{ '--progress': `${value * 3.6}deg` } as React.CSSProperties}><span>{Math.round(value)}%</span></div>;
}
function DotMatrix() {
  return <div className="dot-matrix">{Array.from({ length: 35 }, (_, i) => <i className={i % 6 === 0 ? 'bright' : ''} key={i} />)}</div>;
}
function MiniSpark({ values }: { values: number[] }) {
  const pv = values.length ? values.map((v, i) => `${(i / Math.max(values.length - 1, 1)) * 100},${36 - (v / Math.max(...values, 1)) * 30}`).join(' ') : '0,35 100,35';
  return <svg className="mini-spark" viewBox="0 0 100 40" preserveAspectRatio="none"><polyline points={pv} /></svg>;
}

// ─── Charts ───────────────────────────────────────────────────────────────────
function EquityChart({ daily }: { daily: [string, number][] }) {
  const cumulativeValues: number[] = [];
  let running = 0;
  for (const [, v] of daily) { running += v; cumulativeValues.push(running); }

  if (cumulativeValues.length === 0) {
    return <div className="line-chart"><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#5d7970', fontSize: 12 }}>Sem dados</div></div>;
  }

  const allVals = [0, ...cumulativeValues];
  const maxV = Math.max(...allVals);
  const minV = Math.min(...allVals);
  const range = maxV - minV || 1;
  const W = 100; const H = 85; const padTop = 5;
  const toY = (v: number) => padTop + (1 - (v - minV) / range) * (H - padTop);
  const toX = (i: number) => (i / cumulativeValues.length) * W;
  const pts: [number, number][] = [[0, toY(0)], ...cumulativeValues.map((v, i) => [toX(i + 1), toY(v)] as [number, number])];
  const line = pts.map(([x, y]) => `${x},${y}`).join(' ');
  const area = `0,${H} ${line} ${W},${H}`;
  const ySteps = 4;
  const yLabels = Array.from({ length: ySteps + 1 }, (_, i) => { const val = minV + (i / ySteps) * range; const y = toY(val); return { val, y }; }).reverse();
  const xLabels: { label: string; x: number }[] = [];
  if (daily.length > 0) {
    const step = Math.max(1, Math.floor(daily.length / 5));
    for (let i = 0; i < daily.length; i += step) {
      const [dateStr] = daily[i];
      const d = new Date(`${dateStr}T12:00:00`);
      const label = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
      xLabels.push({ label, x: toX(i + 1) });
    }
  }
  const formatVal = (v: number) => { if (Math.abs(v) >= 1000) return `R$${(v / 1000).toFixed(1)}k`; return `R$${v.toFixed(0)}`; };
  const finalValue = cumulativeValues[cumulativeValues.length - 1] ?? 0;
  const equityColor = finalValue >= 0 ? '#00E88A' : '#FF3D5A';

  return (
    <div className="equity-chart-wrap">
      <div className="equity-svg-area">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
          <defs>
            <linearGradient id="equityArea" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={equityColor} stopOpacity=".35" />
              <stop offset="100%" stopColor={equityColor} stopOpacity="0" />
            </linearGradient>
          </defs>
          <line x1="0" y1={toY(0)} x2={W} y2={toY(0)} stroke="rgba(120,120,120,.2)" strokeWidth="0.5" strokeDasharray="2,2" />
          <polygon points={area} fill="url(#equityArea)" />
          <polyline points={line} fill="none" stroke={equityColor} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      <div className="equity-y-axis">
        {yLabels.map(({ val, y }, i) => (
          <span key={i} style={{ position: 'absolute', top: `${(y / H) * 100}%`, transform: 'translateY(-50%)' }}>{formatVal(val)}</span>
        ))}
      </div>
      <div className="equity-x-axis">
        {xLabels.map(({ label, x }, i) => (
          <span key={i} style={{ position: 'absolute', left: `${x}%`, transform: 'translateX(-50%)' }}>{label}</span>
        ))}
      </div>
    </div>
  );
}

function BarChart({ daily }: { daily: [string, number][] }) {
  if (daily.length === 0) {
    return <div className="bar-chart-wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: '#5d7970', fontSize: 12 }}>Sem dados</div>;
  }
  const values = daily.map(([, v]) => v);
  const absMax = Math.max(...values.map(Math.abs), 1);
  const yTop = absMax * 1.15;
  const yBot = -yTop;
  const yRange = yTop - yBot;
  const toYPct = (v: number) => ((yTop - v) / yRange) * 100;
  const zeroY = toYPct(0);
  const formatMoney = (v: number) => { const abs = Math.abs(v); if (abs >= 1000) return `${v > 0 ? '+' : '-'}R$${(abs / 1000).toFixed(1)}k`; return `${v > 0 ? '+' : v < 0 ? '-' : ''}R$${abs.toFixed(0)}`; };
  const ySteps = [yTop, yTop / 2, 0, yBot / 2, yBot];
  const step = Math.max(1, Math.floor(daily.length / 6));
  const xLabels = daily.map(([dateStr], i) => { if (i % step !== 0) return null; const d = new Date(`${dateStr}T12:00:00`); return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', ''); });
  return (
    <div className="bar-chart-wrap">
      <div className="bchart-bars-area">
        <div className="bchart-zero" style={{ top: `${zeroY}%` }} />
        <div className="bchart-bars">
          {daily.map(([dateStr, v], i) => {
            const barHeight = (Math.abs(v) / yRange) * 100;
            const isPos = v >= 0;
            const dStr = new Date(`${dateStr}T12:00:00`).toLocaleDateString('pt-BR');
            return (
              <div key={i} className="bchart-col">
                <div
                  className={`bchart-bar ${isPos ? 'pos' : 'neg'}`}
                  style={{ height: `${barHeight}%`, bottom: isPos ? `${zeroY}%` : undefined, top: !isPos ? `${toYPct(0)}%` : undefined }}
                  title={`${dStr} | ${formatMoney(v)}`}
                />
                <span className="bchart-label">{xLabels[i] ?? ''}</span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="bchart-y-axis">
        {ySteps.map((v, i) => (
          <span key={i} style={{ position: 'absolute', top: `${toYPct(v)}%`, transform: 'translateY(-50%)' }}>{formatMoney(v)}</span>
        ))}
      </div>
    </div>
  );
}

function HorizontalBars({ trades }: { trades: Trade[] }) {
  const days = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'];
  const results = days.map((_, index) =>
    trades.filter((t) => new Date(`${t.date}T12:00:00`).getDay() === index + 1).reduce((s, t) => s + t.result, 0)
  );
  const maxAbs = Math.max(...results.map(Math.abs), 1);
  return <div className="horizontal-bars">{days.map((day, index) => {
    const result = results[index];
    const pct = Math.abs(result) / maxAbs * 100;
    return <div className="h-row" key={day}><span>{day.slice(0, 3).toUpperCase()}</span><div><i style={{ width: `${pct}%`, background: result > 0 ? '#00E88A' : result < 0 ? '#FF3D5A' : '#777777' }} /></div><b className={getToneClass(result)}>{money(result)}</b></div>;
  })}</div>;
}

function StrategyDistribution({ trades, strategies }: { trades: Trade[]; strategies: string[] }) {
  return (
    <div className="distribution">
      <div className="distribution-bar">{strategies.map((s, i) => <i key={s} className={`segment s-${i % 4}`} style={{ width: `${trades.length ? trades.filter((t) => t.strategy === s).length / trades.length * 100 : 0}%` }} />)}</div>
      {strategies.map((s, i) => <div className="distribution-row" key={s}><span className={`legend-dot ld-${i % 4}`} /> <b>{s}</b><span>{trades.filter((t) => t.strategy === s).length} trades</span><strong>{trades.length ? Math.round(trades.filter((t) => t.strategy === s).length / trades.length * 100) : 0}%</strong></div>)}
    </div>
  );
}

function GainDonut({ trades, strategies }: { trades: Trade[]; strategies: string[] }) {
  const stratResults = strategies.map((s) => ({
    strategy: s,
    total: trades.filter((t) => t.strategy === s).reduce((sum, t) => sum + t.result, 0),
    count: trades.filter((t) => t.strategy === s).length,
  })).filter((g) => g.count > 0);
  const totalResult = stratResults.reduce((s, g) => s + g.total, 0);
  const totalAbs = stratResults.reduce((s, g) => s + Math.abs(g.total), 0) || 1;
  if (stratResults.length === 0) return <div className="donut-empty">Sem ganhos registrados</div>;
  let offset = 0;
  const segments = stratResults.map((g) => {
    const pct = (Math.abs(g.total) / totalAbs) * 100;
    const start = offset;
    offset += pct;
    return { ...g, pct, start, color: g.total >= 0 ? '#00E88A' : '#FF3D5A' };
  });
  const centerColor = totalResult >= 0 ? '#00E88A' : '#FF3D5A';
  return (
    <>
      <div className="donut" style={{ background: `conic-gradient(${segments.map((s) => `${s.color} ${s.start}% ${s.start + s.pct}%`).join(', ')})` }}>
        <div><strong style={{ color: centerColor }}>{money(totalResult)}</strong><span>resultado</span></div>
      </div>
      <div className="legend">{segments.map((g) => (
        <div key={g.strategy}>
          <span className="legend-dot" style={{ background: g.total >= 0 ? '#00E88A' : '#FF3D5A' }} />
          <b>{g.strategy.slice(0, 2).toUpperCase()}</b>
          <span>{g.pct.toFixed(0)}%</span>
          <strong style={{ color: g.total >= 0 ? '#00E88A' : '#FF3D5A' }}>{money(g.total)}</strong>
        </div>
      ))}</div>
    </>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
type DashboardProps = {
  trades: Trade[];
  activeAccount: string;
  operationalConfig?: OperationalConfig | null;
  onAdd: () => void;
  onEdit: (t: Trade) => void;
  onDelete: (id: number) => void;
  onImport: () => void;
};

export default function Dashboard({ trades, activeAccount, operationalConfig, onAdd, onEdit, onDelete, onImport }: DashboardProps) {
  const activeStrategies = operationalConfig?.strategies?.length ? operationalConfig.strategies : STRATEGIES;
  const [filterMode, setFilterMode] = useState<'today' | 'week' | 'month' | 'all' | 'custom'>('month');
  const [showFilter, setShowFilter] = useState(false);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [resultFilter, setResultFilter] = useState<'all' | 'gain' | 'loss' | 'breakeven' | 'compra' | 'venda'>('all');
  const [dayModal, setDayModal] = useState(false);
  const [viewTrade, setViewTrade] = useState<Trade | null>(null);
  const [viewStrategy, setViewStrategy] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(15);

  // Reseta a paginação ao mudar o filtro
  useEffect(() => {
    setVisibleCount(15);
  }, [filterMode, customStartDate, customEndDate, resultFilter]);

  const periodLabel = useMemo(() => {
    switch (filterMode) {
      case 'today': return 'Hoje';
      case 'week': return 'Esta Semana';
      case 'month': return 'Este Mês';
      case 'custom': {
        if (customStartDate && customEndDate) return `${customStartDate} até ${customEndDate}`;
        if (customStartDate) return `A partir de ${customStartDate}`;
        if (customEndDate) return `Até ${customEndDate}`;
        return 'Data Personalizada';
      }
      case 'all': return 'Todo o período';
      default: return 'Período Selecionado';
    }
  }, [filterMode, customStartDate, customEndDate]);

  const dateFilteredTrades = useMemo(() => {
    const now = new Date();
    // Data local (YYYY-MM-DD) imune a desvios de fuso UTC
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
  }, [trades, filterMode, customStartDate, customEndDate]);

  const stats = useMemo(() => calculateStats(dateFilteredTrades), [dateFilteredTrades]);
  const equity = dateFilteredTrades.reduce<number[]>((values, t) => [...values, (values[values.length - 1] ?? 0) + t.result], []);
  const daily = Object.entries(dateFilteredTrades.reduce<Record<string, number>>((r, t) => ({ ...r, [t.date]: (r[t.date] ?? 0) + t.result }), {})).sort(([a], [b]) => a.localeCompare(b));
  
  const filteredTrades = useMemo(() => {
    if (resultFilter === 'all') return dateFilteredTrades;
    if (resultFilter === 'gain') return dateFilteredTrades.filter((t) => t.result > 0);
    if (resultFilter === 'loss') return dateFilteredTrades.filter((t) => t.result < 0);
    if (resultFilter === 'breakeven') return dateFilteredTrades.filter((t) => t.result === 0);
    if (resultFilter === 'compra') return dateFilteredTrades.filter((t) => t.details?.direction === 'Compra');
    if (resultFilter === 'venda') return dateFilteredTrades.filter((t) => t.details?.direction === 'Venda');
    return dateFilteredTrades;
  }, [dateFilteredTrades, resultFilter]);

  const sortedTrades = useMemo(() => sortTradesForTable(filteredTrades), [filteredTrades]);

  if (trades.length === 0) {
    return (
      <>
        <div className="page-heading">
          <div>
            <div className="eyebrow"><span className="green-dot" /> VISÃO GERAL</div>
            <h1>Diário <span className="muted">/</span> Performance</h1>
            <p>Acompanhe sua evolução e mantenha o processo sob controle.</p>
          </div>
          <div className="heading-actions"><button className="primary-button" onClick={onAdd}><Plus size={16} /> Nova operação</button></div>
        </div>
        <div className="empty-state">
          <div className="empty-icon"><Activity size={32} /></div>
          <h2>Nenhuma operação registrada</h2>
          <p>Adicione sua primeira operação para começar a acompanhar sua performance, curva de capital e métricas.</p>
          <button className="primary-button" onClick={onAdd}><Plus size={16} /> Registrar primeira operação</button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow"><span className="green-dot" /> VISÃO GERAL</div>
          <h1>Diário <span className="muted">/</span> Performance</h1>
          <p>Acompanhe sua evolução e mantenha o processo sob controle.</p>
        </div>
        <div className="heading-actions">
          <div style={{ position: 'relative' }}>
            <button className="outline-button" onClick={() => setShowFilter(!showFilter)}><Filter size={15} /> Filtrar ({filterMode === 'today' ? 'Hoje' : filterMode === 'week' ? 'Semana' : filterMode === 'month' ? 'Mês' : 'Tudo'})</button>
            {showFilter && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 9 }} onClick={() => setShowFilter(false)} />
                <div className="filter-dropdown" style={{ width: '220px' }}>
                  <h4>Período</h4>
                  <button className={`filter-opt ${filterMode === 'today' ? 'active' : ''}`} onClick={() => { setFilterMode('today'); setShowFilter(false); }}>Hoje</button>
                  <button className={`filter-opt ${filterMode === 'week' ? 'active' : ''}`} onClick={() => { setFilterMode('week'); setShowFilter(false); }}>Esta Semana</button>
                  <button className={`filter-opt ${filterMode === 'month' ? 'active' : ''}`} onClick={() => { setFilterMode('month'); setShowFilter(false); }}>Este Mês</button>
                  <button className={`filter-opt ${filterMode === 'all' ? 'active' : ''}`} onClick={() => { setFilterMode('all'); setShowFilter(false); }}>Todo o período</button>
                  <button className={`filter-opt ${filterMode === 'custom' ? 'active' : ''}`} onClick={() => setFilterMode('custom')}>Data Personalizada</button>
                  {filterMode === 'custom' && (
                    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label style={{ fontSize: 10, color: '#958e8a' }}>De:<input type="date" value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)} style={{ width: '100%', padding: '6px', background: '#161412', border: '1px solid #3d1600', color: '#e0dedd', borderRadius: 4, marginTop: 2 }} /></label>
                      <label style={{ fontSize: 10, color: '#958e8a' }}>Até:<input type="date" value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} style={{ width: '100%', padding: '6px', background: '#161412', border: '1px solid #3d1600', color: '#e0dedd', borderRadius: 4, marginTop: 2 }} /></label>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
          <button className="outline-button" onClick={onImport}><Upload size={15} /> Importar</button>
          <button className="primary-button" onClick={onAdd}><Plus size={16} /> Nova operação</button>
        </div>
      </div>
      <div className="dashboard-grid stats-grid">
        <StatCard label="Resultado Total" value={money(stats.totalResult)} meta="resultado acumulado" icon={<TrendingUp size={17} />} tone={stats.totalResult > 0 ? "green" : stats.totalResult < 0 ? "red" : "neutral"} chart={<MiniSpark values={equity} />} />
        <StatCard label="Win Rate" value={`${stats.winRate.toFixed(1)}%`} meta={`${stats.wins} W  ·  ${stats.breakeven} BE  ·  ${stats.losses} L`} icon={<Target size={17} />} tone={stats.winRate >= 50 ? "green" : "red"} chart={<Ring value={stats.winRate} />} />
        <StatCard label="Dias Operados" value={String(stats.tradingDays)} meta="neste período" icon={<CalendarDays size={17} />} tone="cyan" chart={<DotMatrix />} onClick={() => setDayModal(true)} />
        <StatCard label="Max Drawdown" value={money(stats.maxDrawdown)} meta={stats.peak ? `${Math.abs(stats.maxDrawdown / stats.peak * 100).toFixed(1)}% do pico` : 'sem pico registrado'} icon={<TrendingDown size={17} />} tone="red" />
      </div>
      <div className="dashboard-grid charts-grid">
        <ChartCard title="Curva de Capital" subtitle="Resultado acumulado em R$" className="equity-card"><EquityChart daily={daily} /></ChartCard>
        <ChartCard title="Resultado Diário" subtitle="Performance por sessão" className="daily-card"><BarChart daily={daily} /></ChartCard>
      </div>
      <section className="section">
        <SectionHeading title="Performance por Estratégia" action="ver detalhes" />
        <div className="strategy-grid">
          {activeStrategies.map((strategy, index) => {
            const items = dateFilteredTrades.filter((t) => t.strategy === strategy);
            const result = items.reduce((sum, t) => sum + t.result, 0);
            const winsFor = items.filter((t) => t.result > 0).length;
            return (
              <div className="strategy-card stat-card-clickable" key={strategy} onClick={() => setViewStrategy(strategy)} style={{ cursor: 'pointer' }}>
                <div className={`strategy-icon i-${index % 4}`}><Zap size={14} /></div>
                <div className="strategy-title">{strategy}<button onClick={e => { e.stopPropagation(); setViewStrategy(strategy); }}><MoreHorizontal size={16} /></button></div>
                <div className={`strategy-result ${getToneClass(result)}`}>{money(result)}</div>
                <div className="strategy-footer"><span>Assertividade <b>{items.length ? Math.round((winsFor / items.length) * 100) : 0}%</b></span><span>{items.length} ops</span></div>
                <div className="strategy-average">Média / operação <strong>{money(items.length ? result / items.length : 0)}</strong></div>
              </div>
            );
          })}
        </div>
      </section>
      <section className="section">
        <SectionHeading title="Métricas Complementares" />
        <div className="dashboard-grid metric-grid">
          <MetricCard label="Média Vencedora" value={money(stats.winnersAverage)} hint="por trade" tone={stats.winnersAverage === 0 ? 'neutral' : 'green'} />
          <MetricCard label="Média Perdedora" value={money(stats.losersAverage)} hint="por trade" tone={stats.losersAverage === 0 ? 'neutral' : 'red'} />
          <MetricCard label="Risco x Retorno" value={`${stats.riskReward.toFixed(2)} : 1`} hint="razão média" tone={stats.riskReward === 0 ? 'neutral' : stats.riskReward >= 1 ? 'green' : 'red'} />
          <MetricCard label="Profit Factor" value={stats.profitFactor.toFixed(2)} hint="ganho / perda total" tone={stats.profitFactor === 0 ? 'neutral' : stats.profitFactor >= 1 ? 'green' : 'red'} />
        </div>
      </section>
      <section className="section recent-section">
        <SectionHeading title="Operações" />
        <div className="result-filters" style={{ flexWrap: 'wrap' }}>
          <button className={resultFilter === 'all' ? 'active' : ''} onClick={() => setResultFilter('all')}>Todas <span>{dateFilteredTrades.length}</span></button>
          <button className={resultFilter === 'gain' ? 'active gain' : ''} onClick={() => setResultFilter('gain')}>Gain <span>{dateFilteredTrades.filter((t) => t.result > 0).length}</span></button>
          <button className={resultFilter === 'loss' ? 'active loss' : ''} onClick={() => setResultFilter('loss')}>Loss <span>{dateFilteredTrades.filter((t) => t.result < 0).length}</span></button>
          <button className={resultFilter === 'breakeven' ? 'active be' : ''} onClick={() => setResultFilter('breakeven')}>0 x 0 <span>{dateFilteredTrades.filter((t) => t.result === 0).length}</span></button>
          <button className={resultFilter === 'compra' ? 'active buy' : ''} onClick={() => setResultFilter('compra')} style={{ marginLeft: '10px' }}>Compras <span>{dateFilteredTrades.filter((t) => t.details?.direction === 'Compra').length}</span></button>
          <button className={resultFilter === 'venda' ? 'active sell' : ''} onClick={() => setResultFilter('venda')}>Vendas <span>{dateFilteredTrades.filter((t) => t.details?.direction === 'Venda').length}</span></button>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Data</th><th>Ativo</th><th>Estratégia</th><th>Contratos</th><th>Pontos</th><th>Resultado</th><th /></tr></thead>
            <tbody>
              {sortedTrades.length === 0 ? (
                <tr><td colSpan={7} className="empty-row">Nenhuma operação neste filtro</td></tr>
              ) : sortedTrades.slice(0, visibleCount).map((t) => (
                <tr key={t.id} style={{ cursor: 'pointer' }} onClick={() => setViewTrade(t)}>
                  <td>
                    <div>{shortDate(t.date)}</div>
                    {t.details?.entryTime && (
                      <span style={{ fontSize: '11px', color: '#8c827a', fontFamily: 'monospace' }}>
                        {t.details.entryTime}
                      </span>
                    )}
                  </td>
                  <td><span className="asset-pill">{t.asset}</span></td>
                  <td>{t.strategy}</td>
                  <td className="mono muted-text">{t.contracts}</td>
                  <td className={`${getToneClass(calculateAveragePoints(t))} mono`}>{points(calculateAveragePoints(t))}</td>
                  <td className={`${getToneClass(t.result)} mono strong`}>{money(t.result)}</td>
                  <td className="action-cell" onClick={e => e.stopPropagation()}>
                    {t.hadAddition && <span className="badge-row"><span className="op-badge add" title="Teve adição"><Scissors size={11} /></span></span>}
                    <button className="table-action" onClick={() => onEdit(t)}><Edit3 size={14} /></button>
                    <button className="table-action danger-action" onClick={() => onDelete(t.id)}><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {sortedTrades.length > visibleCount && (
            <div style={{ padding: '16px', display: 'flex', justifyContent: 'center', borderTop: '1px solid #1f1410', background: '#0d0a08' }}>
              <button 
                className="outline-button" 
                onClick={() => setVisibleCount(c => c + 15)}
                style={{ width: '100%', maxWidth: '300px' }}
              >
                Carregar mais
              </button>
            </div>
          )}
        </div>
      </section>
      <section className="section">
        <SectionHeading title="Análise com Inteligência Artificial" />
        <DiarySummary
          trades={dateFilteredTrades}
          observations={dateFilteredTrades.map(t => t.note).filter(Boolean).join('\n')}
          activeAccount={activeAccount}
          periodLabel={periodLabel}
        />
      </section>
      {dayModal && <DayCalendarModal trades={trades} onClose={() => setDayModal(false)} onAdd={onAdd} onViewTrade={(t) => { setDayModal(false); setViewTrade(t); }} />}
      {viewTrade && <TradeDetailModal trade={viewTrade} onClose={() => setViewTrade(null)} onEdit={(t) => { setViewTrade(null); onEdit(t); }} onDelete={(id) => { setViewTrade(null); onDelete(id); }} />}
      {viewStrategy && <StrategyDetailModal strategy={viewStrategy} trades={dateFilteredTrades} onClose={() => setViewStrategy(null)} onViewTrade={(t) => { setViewStrategy(null); setViewTrade(t); }} />}
    </>
  );
}


