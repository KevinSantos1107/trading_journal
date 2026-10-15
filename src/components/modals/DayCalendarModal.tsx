import { useState, useRef } from 'react';
import { ArrowLeft, ArrowRight, CalendarDays, Check, CheckCircle2, Plus, RotateCcw, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';
import type { Trade } from '@/lib/types';
import { money, points, shortDate, getToneClass, calculateAveragePoints, sortTradesChrono } from '@/lib/calc';
import { triggerConfetti } from '@/lib/confetti';
import { useStreak, setDayFinalized } from '@/lib/streak';

type Props = { trades: Trade[]; onClose: () => void; onAdd: () => void; initialDate?: string; onViewTrade: (t: Trade) => void };

export default function DayCalendarModal({ trades, onClose, onAdd, initialDate, onViewTrade }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const startD = initialDate ? new Date(`${initialDate}T12:00:00`) : new Date();
  const [viewYear, setViewYear] = useState(startD.getFullYear());
  const [viewMonth, setViewMonth] = useState(startD.getMonth());
  const [selectedDay, setSelectedDay] = useState<string | null>(initialDate || null);

  const streak = useStreak(trades);
  const isFinalized = streak.finalizedDays.has(today);
  const [isAnimating, setIsAnimating] = useState(false);
  const finalizeBtnRef = useRef<HTMLButtonElement>(null);

  const handleFinalizeDay = () => {
    if (isAnimating) return;
    setIsAnimating(true);

    if (finalizeBtnRef.current) {
      const rect = finalizeBtnRef.current.getBoundingClientRect();
      triggerConfetti(rect.left + rect.width / 2, rect.top + rect.height / 2);
    } else {
      triggerConfetti();
    }

    setDayFinalized(today, true);

    const newStreak = streak.isTodayCompleted ? streak.currentStreak : streak.currentStreak + 1;
    toast.success(`🎉 Dia finalizado! Sequência de disciplina mantida: ${newStreak} ${newStreak === 1 ? 'dia' : 'dias'} seguidos.`);

    setTimeout(() => {
      setIsAnimating(false);
    }, 1000);
  };

  const handleReopenDay = () => {
    setDayFinalized(today, false);
    toast.info('Dia reaberto para novos registros.');
  };

  const byDay = trades.reduce<Record<string, { result: number; trades: Trade[] }>>((r, t) => {
    return { ...r, [t.date]: { result: (r[t.date]?.result ?? 0) + t.result, trades: [...(r[t.date]?.trades ?? []), t] } };
  }, {});

  const weekdays = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
  const monthName = new Date(viewYear, viewMonth, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const selectedTrades = selectedDay ? sortTradesChrono(byDay[selectedDay]?.trades ?? []) : [];
  const selectedResult = selectedTrades.reduce((s, t) => s + t.result, 0);
  const isToday = selectedDay === today;
  const totalDays = Object.keys(byDay).length;
  const tradedDays = Object.keys(byDay).filter(d => { const date = new Date(`${d}T12:00:00`); return date.getFullYear() === viewYear && date.getMonth() === viewMonth; }).length;

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="day-cal-modal">
        <div className="day-cal-header">
          <div>
            <div className="eyebrow"><span className="green-dot" /> CALENDÁRIO DE PERFORMANCE</div>
            <h2>{monthName}</h2>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="icon-button" onClick={() => { const d = new Date(viewYear, viewMonth - 1); setViewMonth(d.getMonth()); setViewYear(d.getFullYear()); }}><ArrowLeft size={15} /></button>
            <button className="icon-button" onClick={() => { const d = new Date(viewYear, viewMonth + 1); setViewMonth(d.getMonth()); setViewYear(d.getFullYear()); }}><ArrowRight size={15} /></button>
            <button className="icon-button" onClick={onClose}><X size={16} /></button>
          </div>
        </div>
        <div className="day-cal-body">
          <div className="day-cal-left">
            <div className="calendar-weekdays">{weekdays.map(w => <span key={w}>{w}</span>)}</div>
            <div className="calendar-grid">
              {Array.from({ length: firstWeekday }, (_, i) => <div key={`e${i}`} className="calendar-day empty" />)}
              {Array.from({ length: daysInMonth }, (_, i) => {
                const day = i + 1;
                const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const data = byDay[dateStr];
                const isSelected = selectedDay === dateStr;
                const isTodayDay = dateStr === today;
                let cls = 'calendar-day';
                if (data) cls += data.result > 0 ? ' profit' : data.result < 0 ? ' loss' : ' breakeven-day';
                if (isSelected) cls += ' selected-day';
                if (isTodayDay) cls += ' today-day';
                return (
                  <div key={dateStr} className={cls} onClick={() => setSelectedDay(isSelected ? null : dateStr)} style={{ cursor: data || isTodayDay ? 'pointer' : 'default' }}>
                    <b>{day}</b>
                    {data && <small>{money(data.result)}</small>}
                    {isTodayDay && !data && <small style={{ color: '#5d7970' }}>hoje</small>}
                  </div>
                );
              })}
            </div>
            <div className="day-cal-progress">
              <div className="day-cal-prog-info"><span>Dias operados no mês</span><b>{tradedDays} dias</b></div>
              <div className="day-cal-prog-bar"><div style={{ width: `${Math.min((tradedDays / 22) * 100, 100)}%` }} /></div>
              <div className="day-cal-prog-info" style={{ marginTop: 6 }}><span>Total acumulado ({totalDays} dias)</span><b className={getToneClass(trades.reduce((s, t) => s + t.result, 0))}>{money(trades.reduce((s, t) => s + t.result, 0))}</b></div>
            </div>
          </div>
          <div className="day-cal-right">
            {selectedDay ? (
              <>
                <div className="day-detail-header">
                  <span className="eyebrow">{new Date(`${selectedDay}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</span>
                  {selectedTrades.length > 0 && <div className={`day-detail-result ${getToneClass(selectedResult)}`}>{money(selectedResult)}</div>}
                </div>
                {selectedTrades.length === 0 ? (
                  <div className="day-detail-empty">
                    <CalendarDays size={28} />
                    <p>Nenhuma operação neste dia</p>
                    {isToday && <button className="primary-button" onClick={onAdd}><Plus size={14} /> Registrar operação</button>}
                  </div>
                ) : (
                  <div className="day-detail-trades">
                    {selectedTrades.map((t) => (
                      <div key={t.id} className="day-trade-row" onClick={() => onViewTrade(t)} style={{ cursor: 'pointer' }}>
                        <div className="day-trade-main">
                          <span className="asset-pill">{t.asset}</span>
                          <span className="day-trade-strat">{t.strategy}</span>
                          {t.details?.entryTime && (
                            <span className="muted-text mono" style={{ fontSize: '11px', marginLeft: '6px' }}>
                              {t.details.entryTime}
                            </span>
                          )}
                        </div>
                        <div className="day-trade-nums">
                          <span className="muted-text mono">{t.contracts} cts</span>
                          <span className={`${getToneClass(calculateAveragePoints(t))} mono`}>{points(calculateAveragePoints(t))}</span>
                          <span className={`${getToneClass(t.result)} mono strong`}>{money(t.result)}</span>
                        </div>
                      </div>
                    ))}
                    <div className="day-detail-total"><span>Total do dia</span><span className={`${getToneClass(selectedResult)} mono strong`}>{money(selectedResult)}</span></div>
                  </div>
                )}
                {isToday && (
                  <div className={`day-finalize-box ${isFinalized ? 'finalized' : ''}`}>
                    <div>
                      <strong>
                        {isFinalized ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#00E88A' }}>
                            <CheckCircle2 size={15} /> Dia Finalizado
                          </span>
                        ) : (
                          'Finalizar o dia'
                        )}
                      </strong>
                      <small>
                        {isFinalized
                          ? `Sequência atual: 🔥 ${streak.currentStreak} ${streak.currentStreak === 1 ? 'dia' : 'dias'} seguidos`
                          : streak.currentStreak > 0
                            ? `🔥 ${streak.currentStreak} ${streak.currentStreak === 1 ? 'dia' : 'dias'} seguidos — mantenha!`
                            : 'Comece sua sequência de disciplina hoje'}
                      </small>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {isFinalized ? (
                        <>
                          <button
                            type="button"
                            className="btn-finalized-badge"
                            disabled
                          >
                            <Check size={13} /> Concluído
                          </button>
                          <button
                            type="button"
                            className="btn-finalize-reopen"
                            onClick={handleReopenDay}
                            title="Reabrir dia para novos registros"
                          >
                            <RotateCcw size={13} />
                          </button>
                        </>
                      ) : (
                        <button
                          ref={finalizeBtnRef}
                          type="button"
                          className={`primary-button btn-finalize ${isAnimating ? 'animating' : ''}`}
                          onClick={handleFinalizeDay}
                          disabled={isAnimating}
                        >
                          <Sparkles size={14} className={isAnimating ? 'spin-sparkle' : ''} />
                          {isAnimating ? 'Finalizando...' : 'Finalizar dia'}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="day-detail-empty">
                <CalendarDays size={32} />
                <p>Selecione um dia no calendário para ver os detalhes</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
