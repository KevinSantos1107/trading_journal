import { useCallback, useState } from 'react';
import { CircleHelp, Edit3, Trash2, X } from 'lucide-react';
import type { Trade } from '@/lib/types';
import { money, points, calculateAveragePoints } from '@/lib/calc';
import Lightbox from '@/components/ui/Lightbox';

type Props = { trade: Trade; onClose: () => void; onEdit: (t: Trade) => void; onDelete: (id: number) => void };

export default function TradeDetailModal({ trade, onClose, onEdit, onDelete }: Props) {
  const avgPts = calculateAveragePoints(trade);
  const d = trade.details;
  const hasPartials = (trade.partials?.length ?? 0) > 0;
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const closeLightbox = useCallback(() => setLightboxSrc(null), []);

  const InfoRow = ({ label, value, tone }: { label: string; value: string; tone?: string }) => (
    <div className="tdet-row">
      <span className="tdet-label">{label}</span>
      <span className={`tdet-value ${tone ?? ''}`}>{value}</span>
    </div>
  );

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="tdet-modal">
        <div className="tdet-header">
          <div>
            <div className="eyebrow"><span className="green-dot" /> DETALHE DA OPERAÇÃO</div>
            <h2>{new Date(`${trade.date}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</h2>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="icon-button" onClick={() => { onClose(); onEdit(trade); }}><Edit3 size={15} /></button>
            <button className="icon-button" style={{ color: '#fb6376' }} onClick={() => { onDelete(trade.id); onClose(); }}><Trash2 size={15} /></button>
            <button className="icon-button" onClick={onClose}><X size={16} /></button>
          </div>
        </div>
        <div className={`tdet-banner ${trade.result > 0 ? 'banner-pos' : trade.result < 0 ? 'banner-neg' : 'banner-zero'}`}>
          <div><span className="tdet-banner-label">Resultado financeiro</span><span className="tdet-banner-val">{money(trade.result)}</span></div>
          <div><span className="tdet-banner-label">Pontos médios</span><span className="tdet-banner-val">{points(avgPts)}</span></div>
          <div><span className="tdet-banner-label">Contratos</span><span className="tdet-banner-val">{trade.contracts}</span></div>
          {d?.direction && (<div><span className="tdet-banner-label">Direção</span><span className={`tdet-banner-val ${d.direction === 'Compra' ? 'positive' : 'negative'}`}>{d.direction === 'Compra' ? '▲ Compra' : '▼ Venda'}</span></div>)}
        </div>
        <div className="tdet-body">
          <div className="tdet-col">
            <div className="tdet-section-title">Identificação</div>
            <InfoRow label="Ativo" value={trade.asset} />
            <InfoRow label="Estratégia" value={trade.strategy} />
            {d?.account && <InfoRow label="Conta" value={d.account} />}
            {(d?.entryTime || d?.exitTime) && (() => {
              let expTime = '';
              if (d?.entryTime && d?.exitTime) {
                const eParts = d.entryTime.split(':').map(Number);
                const xParts = d.exitTime.split(':').map(Number);
                const eSec = (eParts[0] * 3600) + ((eParts[1] || 0) * 60) + (eParts[2] || 0);
                const xSec = (xParts[0] * 3600) + ((xParts[1] || 0) * 60) + (xParts[2] || 0);
                let diffSec = xSec - eSec;
                if (diffSec < 0) diffSec += 24 * 3600;
                const h = Math.floor(diffSec / 3600);
                const m = Math.floor((diffSec % 3600) / 60);
                const s = diffSec % 60;
                if (h > 0) expTime = `${h}h ${m}m`;
                else if (m > 0) expTime = s > 0 ? `${m}m ${s}s` : `${m}m`;
                else expTime = `${s}s`;
              }
              return (<>{d?.entryTime && <InfoRow label="Horário de entrada" value={d.entryTime} />}{d?.exitTime && <InfoRow label="Horário de saída" value={d.exitTime} />}{expTime && <InfoRow label="Tempo em exposição" value={expTime} />}</>);
            })()}
            {(trade.stopLoss !== undefined || d?.mfe !== undefined || d?.mae !== undefined) && (
              <>
                <div className="tdet-section-title" style={{ marginTop: 16 }}>Risco & Extensão</div>
                {trade.stopLoss !== undefined && <InfoRow label="Stop Assumido" value={`−${Math.abs(trade.stopLoss).toLocaleString('pt-BR')} pts`} tone="negative" />}
                {d?.mfe !== undefined && <InfoRow label="MEP — Máx a Favor" value={`+${Math.abs(d.mfe).toLocaleString('pt-BR')} pts`} tone="positive" />}
                {d?.mae !== undefined && <InfoRow label="MEN — Máx Contra" value={`−${Math.abs(d.mae).toLocaleString('pt-BR')} pts`} tone="negative" />}
              </>
            )}
            {hasPartials && (
              <>
                <div className="tdet-section-title" style={{ marginTop: 16 }}>Saídas Parciais</div>
                {trade.partials!.map((p, i) => <InfoRow key={i} label={`Parcial ${i + 1}`} value={`${p.contracts} cts · ${points(p.points)}`} />)}
              </>
            )}
          </div>
          <div className="tdet-col">
            {(d?.emotion || d?.imageUrl) && (
              <div className="tdet-text-grid">
                {d?.emotion && <div className="tdet-text-block"><span className="tdet-label">Estado emocional</span><p>{Array.isArray(d.emotion) ? d.emotion.join(', ') : d.emotion}</p></div>}
                {d?.imageUrl && (
                  <div className="tdet-text-block tdet-print">
                    <span className="tdet-label">Print da Operação</span>
                    <div className="trade-print-preview" onClick={() => setLightboxSrc(d.imageUrl!)}>
                      <img src={d.imageUrl} alt="Print" />
                      <div className="print-overlay"><span>🔍 Ampliar</span></div>
                    </div>
                  </div>
                )}
              </div>
            )}
            {lightboxSrc && <Lightbox src={lightboxSrc} onClose={closeLightbox} />}
            {d?.qualityFilters && Object.keys(d.qualityFilters).length > 0 && (
              <>
                <div className="tdet-section-title" style={{ marginTop: d?.emotion || d?.imageUrl ? 16 : 0 }}>Filtros de entrada</div>
                <div className="tdet-tags">
                  {Object.keys(d.qualityFilters).map(filter => (
                    <span key={filter} className={`tdet-tag ${d.qualityFilters![filter] ? 'tag-pos' : 'tag-neg'}`}>
                      {d.qualityFilters![filter] ? '✓' : '✕'} {filter}
                    </span>
                  ))}
                </div>
              </>
            )}
            {d?.marketContext && (<><div className="tdet-section-title" style={{ marginTop: 16 }}>Contexto do Mercado</div><div className="tdet-note-box">{d.marketContext}</div></>)}
            {trade.note && (<><div className="tdet-section-title" style={{ marginTop: 16 }}>Observações da Execução</div><div className="tdet-note-box">{trade.note}</div></>)}
            {!trade.note && !d?.emotion && !(d?.qualityFilters && Object.keys(d.qualityFilters).length) && (
              <div className="tdet-empty-note"><CircleHelp size={24} /><p>Nenhuma observação registrada para esta operação.</p></div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
