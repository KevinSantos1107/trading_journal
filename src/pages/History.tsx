import { useState } from 'react';
import { Activity, ArrowLeft, ArrowRight, CalendarDays, CircleDollarSign, Flame, Gauge, Plus } from 'lucide-react';
import type { Trade } from '@/lib/types';
import type { OperationalConfig } from '@/lib/types';
import { STRATEGIES, money, getToneClass } from '@/lib/calc';
import DayCalendarModal from '@/components/modals/DayCalendarModal';
import TradeDetailModal from '@/components/modals/TradeDetailModal';

function StatCard({ label, value, meta, icon, tone }: { label: string; value: string; meta: React.ReactNode; icon: React.ReactNode; tone: string }) {
  return (
    <div className={`stat-card tone-${tone}`}>
      <div className="stat-label">{icon}<span>{label}</span></div>
      <strong className="stat-value">{value}</strong>
      <span className="stat-meta">{meta}</span>
    </div>
  );
}
function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return <div className="chart-card"><div className="chart-header"><div><h3>{title}</h3><span>{subtitle}</span></div></div>{children}</div>;
}
function SectionHeading({ title, action }: { title: string; action?: string }) {
  return <div className="section-heading"><h2>{title}</h2>{action && <button>{action}</button>}</div>;
}
function HorizontalBars({ trades }: { trades: Trade[] }) {
  const days = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'];
  const results = days.map((_, index) => trades.filter((t) => new Date(`${t.date}T12:00:00`).getDay() === index + 1).reduce((s, t) => s + t.result, 0));
  const maxAbs = Math.max(...results.map(Math.abs), 1);
  return <div className="horizontal-bars">{days.map((day, index) => { const result = results[index]; const pct = Math.abs(result) / maxAbs * 100; return <div className="h-row" key={day}><span>{day.slice(0, 3).toUpperCase()}</span><div><i style={{ width: `${pct}%`, background: result > 0 ? '#00E88A' : result < 0 ? '#FF3D5A' : '#777777' }} /></div><b className={getToneClass(result)}>{money(result)}</b></div>; })}</div>;
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
  const stratResults = strategies.map((s) => ({ strategy: s, total: trades.filter((t) => t.strategy === s).reduce((sum, t) => sum + t.result, 0), count: trades.filter((t) => t.strategy === s).length })).filter((g) => g.count > 0);
  const totalResult = stratResults.reduce((s, g) => s + g.total, 0);
  const totalAbs = stratResults.reduce((s, g) => s + Math.abs(g.total), 0) || 1;
  if (stratResults.length === 0) return <div className="donut-empty">Sem ganhos registrados</div>;
  let offset = 0;
  const segments = stratResults.map((g) => { const pct = (Math.abs(g.total) / totalAbs) * 100; const start = offset; offset += pct; return { ...g, pct, start, color: g.total >= 0 ? '#00E88A' : '#FF3D5A' }; });
  const centerColor = totalResult >= 0 ? '#00E88A' : '#FF3D5A';
  return (<><div className="donut" style={{ background: `conic-gradient(${segments.map((s) => `${s.color} ${s.start}% ${s.start + s.pct}%`).join(', ')})` }}><div><strong style={{ color: centerColor }}>{money(totalResult)}</strong><span>resultado</span></div></div><div className="legend">{segments.map((g) => (<div key={g.strategy}><span className="legend-dot" style={{ background: g.total >= 0 ? '#00E88A' : '#FF3D5A' }} /><b>{g.strategy.slice(0, 2).toUpperCase()}</b><span>{g.pct.toFixed(0)}%</span><strong style={{ color: g.total >= 0 ? '#00E88A' : '#FF3D5A' }}>{money(g.total)}</strong></div>))}</div></>);
}

type HistoryProps = {
  trades: Trade[];
  assetFilter: string;
  setAssetFilter: (v: string) => void;
  month: number;
  setMonth: (v: number) => void;
  operationalConfig?: OperationalConfig | null;
  onAdd: () => void;
  onEdit: (t: Trade) => void;
  onDelete: (id: number) => void;
};

export default function History({ trades, assetFilter, setAssetFilter, month, setMonth, operationalConfig, onAdd, onEdit, onDelete }: HistoryProps) {
  const DEFAULT_ASSETS = [{ name: 'Mini Índice', pointValue: 0.20 }, { name: 'Mini Dólar', pointValue: 10.00 }];
  const activeAssets = operationalConfig?.assets?.length ? operationalConfig.assets : DEFAULT_ASSETS;
  const assetNames = activeAssets.map(a => a.name);
  const activeStrategies = operationalConfig?.strategies?.length ? operationalConfig.strategies : STRATEGIES;

  const year = new Date().getFullYear();
  const monthTrades = trades.filter((t) => { const d = new Date(`${t.date}T12:00:00`); return d.getMonth() === month && d.getFullYear() === year; });
  const byDay = monthTrades.reduce<Record<number, { result: number; count: number }>>((r, t) => { const day = Number(t.date.slice(8, 10)); return { ...r, [day]: { result: (r[day]?.result ?? 0) + t.result, count: (r[day]?.count ?? 0) + 1 } }; }, {});
  const weekdays = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
  const monthName = new Date(year, month, 1).toLocaleDateString('pt-BR', { month: 'long' }).replace('.', '');
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthResult = monthTrades.reduce((s, t) => s + t.result, 0);
  const monthWins = monthTrades.filter((t) => t.result > 0).length;
  const monthLosses = monthTrades.filter((t) => t.result < 0).length;
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [viewTrade, setViewTrade] = useState<Trade | null>(null);

  return (
    <>
      <div className="page-heading history-heading">
        <div>
          <div className="eyebrow"><span className="green-dot" /> ANÁLISE TEMPORAL</div>
          <h1>Histórico <span className="muted">/</span> {monthName}</h1>
          <p>Revise suas sessões e encontre padrões que se repetem.</p>
        </div>
        <div className="heading-actions"><button className="outline-button" onClick={onAdd}><Plus size={15} /> Adicionar trade</button></div>
      </div>
      <div className="history-toolbar">
        <div className="filter-tabs">
          {['Todos os ativos', ...assetNames].map((asset) => (
            <button className={assetFilter === asset ? 'active' : ''} key={asset} onClick={() => setAssetFilter(asset)}>{asset}<span>{asset === 'Todos os ativos' ? trades.length : trades.filter((t) => t.asset === asset).length}</span></button>
          ))}
        </div>
        <div className="month-nav">
          <button onClick={() => setMonth(Math.max(0, month - 1))}><ArrowLeft size={15} /></button>
          <strong>{monthName} {year}</strong>
          <button onClick={() => setMonth(Math.min(11, month + 1))}><ArrowRight size={15} /></button>
        </div>
      </div>
      <div className="dashboard-grid stats-grid history-stats">
        <StatCard label="Trades" value={String(monthTrades.length)} meta="no mês selecionado" icon={<Activity size={17} />} tone="cyan" />
        <StatCard label="W / L" value={`${monthWins} W / ${monthLosses} L`} meta={<span className="wl-be-display"><span className="c-pos">{monthWins} W</span> <span className="c-neg">{monthLosses} L</span></span>} icon={<Gauge size={17} />} tone={monthWins >= monthLosses ? "green" : "red"} />
        <StatCard label="Resultado do mês" value={money(monthResult)} meta="resultado líquido" icon={<CircleDollarSign size={17} />} tone={monthResult > 0 ? "green" : monthResult < 0 ? "red" : "neutral"} />
        <StatCard label="Dias Operados" value={String(new Set(monthTrades.map((t) => t.date)).size)} meta="sessões" icon={<CalendarDays size={17} />} tone="cyan" />
      </div>
      <section className="section">
        <SectionHeading title="Calendário de Performance" action="resultado em R$ · operações" />
        <div className="calendar-card">
          <div className="calendar-weekdays">{weekdays.map((d) => <span key={d}>{d}</span>)}</div>
          <div className="calendar-grid">
            {Array.from({ length: firstWeekday }, (_, i) => <div className="calendar-day empty" key={`e${i}`} />)}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1;
              const v = byDay[day];
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              return (
                <div className={`calendar-day ${v ? (v.result >= 0 ? 'profit' : 'loss') : ''}`} key={day} style={v ? { cursor: 'pointer' } : {}} onClick={() => v && setSelectedDay(dateStr)}>
                  <span className="day-number">{day}</span>
                  {v && <div className="day-data"><b>{v.result >= 0 ? '+' : ''}{v.result.toLocaleString('pt-BR')}</b><small>{v.count}T</small></div>}
                </div>
              );
            })}
          </div>
        </div>
      </section>
      <div className="history-columns">
        <ChartCard title="Performance por dia da semana" subtitle="Resultado por sessão"><HorizontalBars trades={monthTrades} /></ChartCard>
        <ChartCard title="Distribuição por estratégia" subtitle="Proporção de operações"><StrategyDistribution trades={monthTrades} strategies={activeStrategies} /></ChartCard>
      </div>
      <div className="history-columns bottom-columns">
        <div className="focus-card">
          <SectionHeading title="Foco do período" action="intensificar" />
          <p className="focus-caption"><Flame size={15} /> Estratégias com maior contribuição</p>
          {activeStrategies.map((strategy, index) => {
            const count = monthTrades.filter((t) => t.strategy === strategy).length;
            const result = monthTrades.filter((t) => t.strategy === strategy).reduce((s, t) => s + t.result, 0);
            if (count === 0) return null;
            return <div className="focus-row" key={strategy}><span className={`focus-index fi-${index % 3}`}>{index + 1}</span><div><strong>{strategy}</strong><small>{count} trades</small></div><b className={getToneClass(result)}>{money(result)}</b></div>;
          })}
          {monthTrades.length === 0 && <p className="donut-empty">Sem operações no período</p>}
        </div>
        <div className="donut-card">
          <SectionHeading title="Origem do ganho" action="por estratégia" />
          <div className="donut-content"><GainDonut trades={monthTrades} strategies={activeStrategies} /></div>
        </div>
      </div>
      {selectedDay && <DayCalendarModal trades={trades} onClose={() => setSelectedDay(null)} onAdd={onAdd} initialDate={selectedDay} onViewTrade={setViewTrade} />}
      {viewTrade && <TradeDetailModal trade={viewTrade} onClose={() => setViewTrade(null)} onEdit={(t) => { setViewTrade(null); onEdit(t); }} onDelete={(id) => { setViewTrade(null); onDelete(id); }} />}
    </>
  );
}
