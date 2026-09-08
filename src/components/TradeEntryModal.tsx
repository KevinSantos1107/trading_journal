import { useMemo, useState, useRef, useEffect } from 'react';
import type { FormEvent } from 'react';
import { Check, ChevronDown, Plus, Trash2, X } from 'lucide-react';
import { ASSET_OPTIONS, POINT_VALUE, STRATEGIES, calculateResult, calculateStopLoss } from '@/lib/calc';
import { uploadTradeImage } from '@/lib/firestore';
import type { PartialExecution, Trade, TradeDetails } from '@/lib/types';

type Props = { trade: Trade | null; userAccounts: string[]; onClose: () => void; onSave: (trade: Trade) => void };
type Checklist = Record<string, boolean>;

const qualityItems = ['Região de média ou Afastado das médias', 'Região de fibo', 'Suporte ou Resistência'];
const emotions = {
  positive: ['Confiante', 'Calmo', 'Focado', 'Atento', 'Paciente'],
  neutral: ['Neutro', 'Cauteloso'],
  negative: ['Ansioso', 'Irritado', 'Impulsivo', 'Vingativo', 'Com medo'],
};


const optimizeImage = async (file: File): Promise<File> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const MAX_WIDTH = 2560;
        const MAX_HEIGHT = 2560;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height = Math.round((height *= MAX_WIDTH / width));
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width = Math.round((width *= MAX_HEIGHT / height));
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject('No canvas context');
        
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob((blob) => {
          if (!blob) return reject('Blob conversion failed');
          const newFileName = file.name.replace(/\.[^/.]+$/, "") + ".webp";
          const newFile = new File([blob], newFileName, { type: 'image/webp' });
          resolve(newFile);
        }, 'image/webp', 0.85);
      };
      img.onerror = (e) => reject(e);
    };
    reader.onerror = (e) => reject(e);
  });
};

function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);
  return (
    <div className="lightbox-overlay" onClick={onClose} style={{ zIndex: 999999 }}>
      <div className="lightbox-inner" onClick={e => e.stopPropagation()}>
        <img src={src} alt="Print da operação" />
      </div>
      <button type="button" className="lightbox-close" onClick={onClose}>×</button>
    </div>
  );
}

function TradePrintUploader({ imageUrl, onUpload, onRemove }: { imageUrl?: string, onUpload: (url: string) => void, onRemove: () => void }) {
  const [status, setStatus] = useState<'idle' | 'optimizing' | 'uploading'>('idle');
  const [isDragging, setIsDragging] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        const items = e.clipboardData?.items;
        let hasImage = false;
        if (items) {
          for (let i = 0; i < items.length; i++) {
            if (items[i].kind === 'file' && items[i].type.startsWith('image/')) hasImage = true;
          }
        }
        if (!hasImage) return; 
      }

      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].kind === 'file' && items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) {
            processFile(file);
            e.preventDefault();
          }
          return;
        }
      }
    };

    document.addEventListener('paste', handleGlobalPaste);
    return () => document.removeEventListener('paste', handleGlobalPaste);
  }, []);

  const processFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Selecione uma imagem válida (PNG, JPG, WEBP)');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      alert('A imagem é excessivamente grande (maior que 20MB). Selecione um arquivo menor.');
      return;
    }

    try {
      setStatus('optimizing');
      const optimizedFile = await optimizeImage(file);
      
      setStatus('uploading');
      const tempId = Date.now();
      const url = await uploadTradeImage(optimizedFile, tempId);
      
      onUpload(url);
    } catch (error) {
      console.error(error);
      alert('Erro ao processar e enviar a imagem. Tente novamente.');
    } finally {
      setStatus('idle');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) processFile(file);
  };

  return (
    <section className="protocol-card print-card">
      <div className="side-label">PRINT DA OPERAÇÃO</div>
      
      {imageUrl ? (
        <div className="print-preview-container">
          <img src={imageUrl} alt="Print da Operação" className="print-preview-img" onClick={() => setLightboxSrc(imageUrl)} />
          <div className="print-actions">
            <button type="button" onClick={() => setLightboxSrc(imageUrl)}>🔍 Ampliar</button>
            <button type="button" onClick={onRemove} className="btn-remove">Substituir / Remover</button>
          </div>
        </div>
      ) : (
        <div 
          className={`print-upload-zone ${isDragging ? 'dragging' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => status === 'idle' && fileInputRef.current?.click()}
        >
          {status !== 'idle' ? (
             <div className="uploading-state">{status === 'optimizing' ? 'Otimizando imagem...' : 'Enviando imagem...'}</div>
          ) : (
            <>
              <div className="upload-icon">📷</div>
              <strong>Adicione o print da operação</strong>
              <span>Cole com Ctrl + V, arraste uma imagem ou clique para selecionar</span>
              <button type="button" className="outline-button upload-btn">Selecionar imagem</button>
            </>
          )}
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={(e) => { if(e.target.files?.[0]) processFile(e.target.files[0]); e.target.value = ''; }} 
            accept="image/png, image/jpeg, image/webp" 
            style={{display: 'none'}} 
          />
        </div>
      )}
      {lightboxSrc && <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
    </section>
  );
}

function TradeEntryModal({ trade, userAccounts, onClose, onSave }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState<Trade>(trade ?? {
    id: Date.now(), date: today, asset: ASSET_OPTIONS[0], strategy: '', contracts: 0,
    points: 0, result: 0, note: '', partials: [], hadAddition: false,
  });
  const [details, setDetails] = useState<TradeDetails>(trade?.details ?? {});
  const [quality, setQuality] = useState<Checklist>(trade?.details?.qualityFilters ?? {});
  const assetKey = form.asset.replace(' (WIN)', '').replace(' (WDO)', '');
  const pointValue = POINT_VALUE[assetKey] ?? 0.2;
  const result = calculateResult(form);
  const stopRisk = form.stopLoss ? calculateStopLoss(form.asset, form.stopLoss, Number(form.contracts) || 0) : 0;
  const qualityCount = Object.values(quality).filter(Boolean).length;
  const percentagePerItem = 100 / qualityItems.length;
  const totalPercentage = Math.round(qualityCount * percentagePerItem);
  const selectedEmotions = Array.isArray(details.emotion) ? details.emotion : (details.emotion ? [details.emotion] : []);
  const partials = form.partials ?? [];
  const averagePoints = useMemo(() => {
    let totalPoints = 0;
    let exitCount = 0;
    if (Number(form.points) !== 0 || (Number(form.contracts) > 0 && partials.length === 0)) {
      totalPoints += Number(form.points || 0);
      exitCount += 1;
    }
    for (const p of partials) {
      if (Number(p.contracts) > 0 || Number(p.points) !== 0) {
        totalPoints += Number(p.points || 0);
        exitCount += 1;
      }
    }
    return exitCount ? totalPoints / exitCount : 0;
  }, [form.points, form.contracts, partials]);

  let exposureTime = '';
  if (details.entryTime && details.exitTime) {
    const eParts = details.entryTime.split(':').map(Number);
    const xParts = details.exitTime.split(':').map(Number);
    const eM = (eParts[0] * 60) + (eParts[1] || 0);
    const xM = (xParts[0] * 60) + (xParts[1] || 0);
    let diff = xM - eM;
    if (diff < 0) diff += 24 * 60;
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    exposureTime = h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  const update = (key: keyof Trade, value: string | number | boolean | undefined) => setForm((current) => ({ ...current, [key]: value }));
  const updateDetails = (key: keyof TradeDetails, value: string | number | boolean | undefined) => setDetails((current) => ({ ...current, [key]: value }));
  const toggle = (group: Checklist, setGroup: (value: Checklist) => void, key: string) => setGroup({ ...group, [key]: !group[key] });
  const chooseEmotion = (emotion: string) => {
    let newEmotions = [...selectedEmotions];
    if (newEmotions.includes(emotion)) {
      newEmotions = newEmotions.filter((e) => e !== emotion);
    } else if (newEmotions.length < 3) {
      newEmotions.push(emotion);
    }
    updateDetails('emotion', newEmotions.length > 0 ? (newEmotions as any) : undefined);
  };
  
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!form.strategy) {
      alert('Por favor, selecione um Setup.');
      return;
    }
    if (!details.direction) {
      alert('Por favor, selecione a direção (Compra ou Venda).');
      return;
    }
    onSave({
      ...form,
      contracts: Number(form.contracts) || 0,
      points: Number(form.points) || 0,
      result,
      partials: partials.filter((item) => item.points !== 0 || item.contracts !== 0),
      details: { ...details, qualityFilters: quality },
    });
  };
  const inputValue = (value: number | undefined) => value === undefined || value === 0 ? '' : value;

  return (
    <div className="modal-backdrop">
      <form className="protocol-modal-v4" onSubmit={submit}>
        
        {/* Header V4 */}
        <div className="v4-header">
          <div className="v4-header-left">
            <div className="v4-eyebrow">
              <span className="v4-blink"></span> TERMINAL EXEC // PRO • SESSÃO ATIVA #{(trade?.id || Date.now()).toString().slice(-4)}
            </div>
            <h2>NOVO REGISTRO DE OPERAÇÃO</h2>
            <div className="v4-subtitle">Protocolo de Execução Institucional · V4.2 Pro · B3 Equity & Derivatives Engine</div>
          </div>
          
          <div className="v4-header-right">
            <div className="v4-score-widget">
              <div className="v4-score-circle" style={{ '--score': `${totalPercentage}%`, '--color': totalPercentage >= 60 ? '#00E88A' : totalPercentage >= 30 ? '#F39C12' : '#FF3D5A' } as React.CSSProperties}>
                <span>{totalPercentage}%</span>
              </div>
              <div className="v4-score-text">
                <small>QUALIDADE TÉCNICA {totalPercentage >= 60 && <Check size={10} color="#00E88A"/>}</small>
                <strong style={{ color: totalPercentage >= 60 ? '#00E88A' : totalPercentage >= 30 ? '#F39C12' : '#FF3D5A' }}>
                  {totalPercentage >= 60 ? 'Alta Confluência' : totalPercentage >= 30 ? 'Média Confluência' : 'Baixa Confluência'}
                </strong>
                <span>{qualityCount} de {qualityItems.length} filtros validados</span>
              </div>
            </div>
            <div className="v4-header-actions">
              <button type="button" className="v4-btn-discard" onClick={onClose}><X size={14}/> Descartar</button>
              <button type="submit" className="v4-btn-save">Salvar Operação <span className="kbd-hint">⌘ + S</span></button>
            </div>
          </div>
        </div>

        <div className="v4-layout">
          {/* Left Column */}
          <div className="v4-col-main">
            {/* Card 1: Identificação */}
            <section className="v4-card">
              <div className="v4-card-header">
                <h3>Identificação da Conta & Execução</h3>
                <span className="v4-card-topright">DMA-2 • FAST FEED B3</span>
              </div>
              
              <div className="v4-grid-2">
                <div className="v4-field">
                  <label>CONTA DE DESTINO</label>
                  <div className="v4-select-wrap">
                    <select value={details.account ?? userAccounts[0] ?? 'Conta Principal'} onChange={(e) => updateDetails('account', e.target.value)}>
                      {userAccounts.map(acc => (
                        <option key={acc} value={acc}>{acc}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="v4-select-arrow"/>
                  </div>
                </div>
                <div className="v4-field">
                  <label>DATA DO PREGÃO</label>
                  <input type="date" value={form.date} onChange={(e) => update('date', e.target.value)} required />
                </div>
              </div>

              <div className="v4-grid-3 mt-4">
                <div className="v4-field">
                  <label>HORÁRIO DE ENTRADA</label>
                  <input type="time" step="1" value={details.entryTime ?? ''} onChange={(e) => updateDetails('entryTime', e.target.value)} />
                </div>
                <div className="v4-field">
                  <label>HORÁRIO DE SAÍDA</label>
                  <input type="time" step="1" value={details.exitTime ?? ''} onChange={(e) => updateDetails('exitTime', e.target.value)} />
                </div>
                <div className="v4-field">
                  <label>TEMPO EM EXPOSIÇÃO</label>
                  <div className="v4-time-diff">{exposureTime || '--'}</div>
                </div>
              </div>

              <div className="v4-grid-2 mt-4">
                <div className="v4-field">
                  <label>ATIVO NEGOCIADO</label>
                  <div className="v4-button-group">
                    {ASSET_OPTIONS.map(asset => {
                      const short = asset === 'Mini Índice' ? 'WIN' : 'WDO';
                      return (
                        <button type="button" key={asset} className={form.asset === asset ? 'active' : ''} onClick={() => update('asset', asset)}>
                          <strong>{short}</strong>
                          <span>{asset}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="v4-field">
                  <label>LADO DA OPERAÇÃO (DIREÇÃO)</label>
                  <div className="v4-button-group direction">
                    <button type="button" className={details.direction === 'Compra' ? 'active buy' : ''} onClick={() => updateDetails('direction', 'Compra')}>↗ COMPRA</button>
                    <button type="button" className={details.direction === 'Venda' ? 'active sell' : ''} onClick={() => updateDetails('direction', 'Venda')}>↘ VENDA</button>
                  </div>
                </div>
              </div>

              <div className="v4-field mt-4">
                <label>ESTRATÉGIA / SETUP OPERACIONAL</label>
                <div className="v4-select-wrap">
                  <select value={form.strategy} onChange={(e) => update('strategy', e.target.value)}>
                    <option value="" disabled>Selecione...</option>
                    {STRATEGIES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <ChevronDown size={14} className="v4-select-arrow"/>
                </div>
              </div>
            </section>

            {/* Card 2: Filtros */}
            <section className="v4-card">
              <div className="v4-card-header">
                <h3>Protocolo de Entrada & Filtros de Setup</h3>
                <span className="v4-card-hint">Confluências Ativas: <b className={qualityCount >= 2 ? 'positive' : ''}>{qualityCount} / {qualityItems.length}</b></span>
              </div>
              <p className="v4-card-desc">Substitui o checklist estático por gatilhos analíticos quantificados. Cada filtro validado adiciona pontuação de aderência operacional.</p>
              
              <div className="v4-filters-grid">
                {qualityItems.map(item => (
                   <button type="button" key={item} className={`v4-filter-btn ${quality[item] ? 'active' : ''}`} onClick={() => toggle(quality, setQuality, item)}>
                     <div className="v4-filter-icon">{quality[item] ? <Check size={14} strokeWidth={3}/> : null}</div>
                     <div className="v4-filter-texts">
                       <strong>{item}</strong>
                     </div>
                     <div className="v4-filter-score">+{Math.round(percentagePerItem)}% score</div>
                   </button>
                ))}
              </div>
            </section>
            
            <section className="v4-card">
              <div className="v4-card-header">
                <h3>Métricas da Operação</h3>
                <span className="v4-card-topright">CONTRATOS · STOP · MEP · MEN</span>
              </div>
              <div className="v4-grid-4 mt-2">
                <div className="v4-field">
                  <label>CONTRATOS</label>
                  <input type="number" min="0" value={inputValue(form.contracts)} onChange={(e) => update('contracts', e.target.value ? Number(e.target.value) : 0)} placeholder="0" />
                </div>
                <div className="v4-field">
                  <label>STOP (PTS)</label>
                  <div className="v4-input-neg-wrap">
                    <span className="v4-neg-sign">−</span>
                    <input type="number" step="any" min="0" value={form.stopLoss !== undefined ? Math.abs(form.stopLoss) : ''} onChange={(e) => update('stopLoss', e.target.value ? -Math.abs(Number(e.target.value)) : undefined)} placeholder="0" />
                  </div>
                </div>
                <div className="v4-field">
                  <label>MEP — MÁX FAVOR</label>
                  <input type="number" step="any" min="0" value={inputValue(details.mfe)} onChange={(e) => updateDetails('mfe', e.target.value ? Number(e.target.value) : undefined)} placeholder="0" />
                </div>
                <div className="v4-field">
                  <label>MEN — MÁX CONTRA</label>
                  <div className="v4-input-neg-wrap">
                    <span className="v4-neg-sign">−</span>
                    <input type="number" step="any" min="0" value={details.mae !== undefined ? Math.abs(details.mae) : ''} onChange={(e) => updateDetails('mae', e.target.value ? -Math.abs(Number(e.target.value)) : undefined)} placeholder="0" />
                  </div>
                </div>
              </div>
              
              <div className="v4-partials mt-4">
                <div className="v4-partials-header">
                  <label>SAÍDAS PARCIAIS</label>
                  <button type="button" onClick={() => setForm((current) => ({ ...current, partials: [...(current.partials ?? []), { points: 0, contracts: 0 }] }))}>
                    <Plus size={12}/> adicionar parcial
                  </button>
                </div>
                <div className="v4-partials-list">
                  {partials.map((partial, index) => (
                    <div className="v4-partial-item" key={index}>
                      <span>#{index + 1}</span>
                      <input type="number" step="any" value={inputValue(partial.points)} onChange={(e) => setForm((current) => ({ ...current, partials: (current.partials ?? []).map((item, itemIndex) => itemIndex === index ? { ...item, points: e.target.value ? Number(e.target.value) : 0 } : item) }))} placeholder="Pontos" />
                      <input type="number" min="0" value={inputValue(partial.contracts)} onChange={(e) => setForm((current) => ({ ...current, partials: (current.partials ?? []).map((item, itemIndex) => itemIndex === index ? { ...item, contracts: e.target.value ? Number(e.target.value) : 0 } : item) }))} placeholder="Contratos" />
                      <button type="button" onClick={() => setForm((current) => ({ ...current, partials: (current.partials ?? []).filter((_, itemIndex) => itemIndex !== index) }))}><Trash2 size={14}/></button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="v4-grid-2 mt-4">
                <div className="v4-field">
                  <label>OBSERVAÇÃO DA EXECUÇÃO</label>
                  <textarea value={form.note} onChange={(e) => update('note', e.target.value)} placeholder="Como foi a execução?" />
                </div>
                <div className="v4-field">
                  <label>CONTEXTO DO MERCADO</label>
                  <textarea value={details.marketContext ?? ''} onChange={(e) => updateDetails('marketContext', e.target.value)} placeholder="Notícias, fluxo..." />
                </div>
              </div>
            </section>
          </div>

          {/* Right Column */}
          <div className="v4-col-side">
            {/* Result Card */}
            <section className="v4-card v4-result-card">
              <div className="v4-card-header no-border">
                <h3>P&L DA OPERAÇÃO</h3>
                {result !== 0 && (
                  <span className={`v4-result-badge ${result > 0 ? 'win' : 'loss'}`}>
                    {result > 0 ? 'VENCEDOR' : 'PERDEDOR'}
                  </span>
                )}
              </div>
              
              <div className={`v4-result-big ${result > 0 ? 'positive' : result < 0 ? 'negative' : ''}`}>
                 {result > 0 ? '+' : result < 0 ? '-' : ''} R$ {Math.abs(result).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>

              <div className="v4-result-stats mt-4">
                <div>
                  <label>RISCO / RETORNO (R:R)</label>
                  <strong>{stopRisk && result > 0 ? `1 : ${(result / stopRisk).toFixed(2)}` : '--'}</strong>
                  <small>Assumido vs Real</small>
                </div>
                <div>
                  <label>MÉDIA EM PONTOS</label>
                  <strong className={averagePoints > 0 ? 'positive' : averagePoints < 0 ? 'negative' : ''}>
                    {averagePoints > 0 ? '+' : ''}{averagePoints.toFixed(1)} pts
                  </strong>
                  <small>Média Final</small>
                </div>
              </div>

              <div className="v4-result-footer">
                <p>Base {form.asset === 'Mini Índice' ? 'WIN' : 'WDO'}: R$ {pointValue.toFixed(2)} por ponto por contrato. Emolumentos e taxas calculados automaticamente conforme regras da B3.</p>
              </div>
            </section>

            {/* Emotion Card */}
            <section className="v4-card">
              <div className="v4-card-header no-border">
                <h3>Estado Emocional</h3>
                <span className="v4-card-hint">Máx. 3 tags ({selectedEmotions.length}/3)</span>
              </div>
              <p className="v4-card-desc">Classifique seu viés psicológico antes e durante a operação para correlacionar com o payoff financeiro.</p>
              
              <div className="v4-emotion-group">
                <label>● ESTADOS CONSTRUTIVOS</label>
                <div className="v4-emotions">
                  {emotions.positive.map(e => <button type="button" key={e} className={`v4-emo-btn pos ${selectedEmotions.includes(e) ? 'active' : ''}`} onClick={() => chooseEmotion(e)}>{selectedEmotions.includes(e) && <div className="dot"/>}{e}</button>)}
                </div>
              </div>
              <div className="v4-emotion-group">
                <label>● NEUTRO / ANALÍTICO</label>
                <div className="v4-emotions">
                  {emotions.neutral.map(e => <button type="button" key={e} className={`v4-emo-btn neu ${selectedEmotions.includes(e) ? 'active' : ''}`} onClick={() => chooseEmotion(e)}>{selectedEmotions.includes(e) && <div className="dot"/>}{e}</button>)}
                </div>
              </div>
              <div className="v4-emotion-group">
                <label>● ESTADOS DE ALERTA / RISCO</label>
                <div className="v4-emotions">
                  {emotions.negative.map(e => <button type="button" key={e} className={`v4-emo-btn neg ${selectedEmotions.includes(e) ? 'active' : ''}`} onClick={() => chooseEmotion(e)}>{selectedEmotions.includes(e) && <div className="dot"/>}{e}</button>)}
                </div>
              </div>
            </section>

            <TradePrintUploader 
              imageUrl={details.imageUrl} 
              onUpload={(url) => updateDetails('imageUrl', url)} 
              onRemove={() => updateDetails('imageUrl', '')} 
            />
          </div>
        </div>

      </form>
    </div>
  );
}

export default TradeEntryModal;
