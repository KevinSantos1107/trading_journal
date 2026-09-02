import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Check, ChevronDown, Plus, Scissors, Shield, Trash2, X } from 'lucide-react';
import { ASSET_OPTIONS, POINT_VALUE, STRATEGIES, calculateResult, calculateStopLoss, money, getToneClass } from '@/lib/calc';
import { uploadTradeImage } from '@/lib/firestore';
import type { PartialExecution, Trade, TradeDetails } from '@/lib/types';

type Props = { trade: Trade | null; onClose: () => void; onSave: (trade: Trade) => void };
type Checklist = Record<string, boolean>;

const mandatoryItems = ['Regiões de trava', 'Dentro dos primeiros 15 minutos do dia'];
const qualityItems = ['Cálculo sem discrepâncias', 'DIFUT confl uindo', 'Escora'];
const emotions = {
  positive: ['Confiante', 'Calmo', 'Focado', 'Atento', 'Paciente'],
  neutral: ['Neutro', 'Cauteloso'],
  negative: ['Ansioso', 'Irritado', 'Impulsivo', 'Vingativo', 'Com medo'],
};

import { useRef, useEffect } from 'react';



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

function TradePrintUploader({ imageUrl, onUpload, onRemove }: { imageUrl?: string, onUpload: (url: string) => void, onRemove: () => void }) {
  const [status, setStatus] = useState<'idle' | 'optimizing' | 'uploading'>('idle');
  const [isDragging, setIsDragging] = useState(false);
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
          <img src={imageUrl} alt="Print da Operação" className="print-preview-img" onClick={() => window.open(imageUrl, '_blank')} />
          <div className="print-actions">
            <button type="button" onClick={() => window.open(imageUrl, '_blank')}>🔍 Ampliar</button>
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
    </section>
  );
}

function TradeEntryModal({ trade, onClose, onSave }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState<Trade>(trade ?? {
    id: Date.now(), date: today, asset: ASSET_OPTIONS[0], strategy: STRATEGIES[0], contracts: 0,
    points: 0, result: 0, note: '', partials: [], hadAddition: false,
  });
  const [details, setDetails] = useState<TradeDetails>(trade?.details ?? {});
  const [mandatory, setMandatory] = useState<Checklist>(trade?.details?.mandatoryRules ?? {});
  const [quality, setQuality] = useState<Checklist>(trade?.details?.qualityFilters ?? {});
  const pointValue = POINT_VALUE[form.asset] ?? 0.2;
  const result = calculateResult(form);
  const stopRisk = form.stopLoss ? calculateStopLoss(form.asset, form.stopLoss, Number(form.contracts) || 0) : 0;
  const mandatoryCount = Object.values(mandatory).filter(Boolean).length;
  const qualityCount = Object.values(quality).filter(Boolean).length;
  const selectedEmotion = details.emotion ?? '';
  const partials = form.partials ?? [];
  const weightedPoints = useMemo(() => {
    const totalContracts = Number(form.contracts) + partials.reduce((sum, item) => sum + Number(item.contracts || 0), 0);
    return totalContracts ? result / pointValue / totalContracts : 0;
  }, [form.contracts, partials, result, pointValue]);

  const update = (key: keyof Trade, value: string | number | boolean | undefined) => setForm((current) => ({ ...current, [key]: value }));
  const updateDetails = (key: keyof TradeDetails, value: string | number | boolean | undefined) => setDetails((current) => ({ ...current, [key]: value }));
  const toggle = (group: Checklist, setGroup: (value: Checklist) => void, key: string) => setGroup({ ...group, [key]: !group[key] });
  const addPartial = () => setForm((current) => ({ ...current, partials: [...(current.partials ?? []), { points: 0, contracts: 0 }] }));
  const removePartial = (index: number) => setForm((current) => ({ ...current, partials: (current.partials ?? []).filter((_, itemIndex) => itemIndex !== index) }));
  const updatePartial = (index: number, key: keyof PartialExecution, value: number) => setForm((current) => ({ ...current, partials: (current.partials ?? []).map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item) }));
  const chooseEmotion = (emotion: string) => updateDetails('emotion', selectedEmotion === emotion ? '' : emotion);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSave({
      ...form,
      contracts: Number(form.contracts) || 0,
      points: Number(form.points) || 0,
      result,
      partials: partials.filter((item) => item.points !== 0 || item.contracts !== 0),
      details: { ...details, mandatoryRules: mandatory, qualityFilters: quality },
    });
  };
  const inputValue = (value: number | undefined) => value === undefined || value === 0 ? '' : value;

  return (
    <div className="modal-backdrop">
      <form className="protocol-modal" onSubmit={submit}>
        <div className="protocol-titlebar">
          <div><h2>REGISTRO DE OPERAÇÃO</h2><span>Protocolo de Performance · V3.8</span></div>
          <div className="quality-pill"><small>QUALIDADE TÉCNICA</small><b>{mandatoryCount === mandatoryItems.length && qualityCount === qualityItems.length ? 'FORTE' : 'FORÇADA'} {mandatoryCount + qualityCount}%</b></div>
          <button type="button" className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="protocol-layout">
          <div className="protocol-main">
            <section className="protocol-card identification-card">
              <div className="protocol-label">IDENTIFICAÇÃO</div>
              <label className="wide-label">CONTA<select value={details.account ?? 'Conta Principal'} onChange={(e) => updateDetails('account', e.target.value)}><option>Conta Principal</option><option>Conta Agressiva</option></select></label>
              <div className="protocol-grid three">
                <label>DATA<input type="date" value={form.date} onChange={(e) => update('date', e.target.value)} required /></label>
                <label>ENTRADA<input type="time" value={details.entryTime ?? ''} onChange={(e) => updateDetails('entryTime', e.target.value)} /></label>
                <label>SAÍDA<input type="time" value={details.exitTime ?? ''} onChange={(e) => updateDetails('exitTime', e.target.value)} /></label>
                <label>ATIVO FINANCEIRO<select value={form.asset} onChange={(e) => update('asset', e.target.value)}>{ASSET_OPTIONS.map((asset) => <option key={asset}>{asset} (WIN)</option>)}</select></label>
                <label>SETUP<select value={form.strategy} onChange={(e) => update('strategy', e.target.value)}>{STRATEGIES.map((strategy) => <option key={strategy}>{strategy}</option>)}</select></label>
                <div className="direction-field"><span>DIREÇÃO</span><div className="direction-buttons"><button type="button" className={details.direction === 'Compra' ? 'selected buy' : 'buy'} onClick={() => updateDetails('direction', 'Compra')}>▲ Compra</button><button type="button" className={details.direction === 'Venda' ? 'selected sell' : 'sell'} onClick={() => updateDetails('direction', 'Venda')}>▼ Venda</button></div></div>
              </div>
            </section>
            <section className="protocol-card">
              <div className="protocol-label">PROTOCOLO DE ENTRADA</div>
              <div className="protocol-grid checklist-grid">
                <ChecklistPanel title="Regras mandatórias" subtitle="todas devem ser marcadas pro trade estar no plano" items={mandatoryItems} values={mandatory} onToggle={(key) => toggle(mandatory, setMandatory, key)} count={`${mandatoryCount}/${mandatoryItems.length}`} />
                <ChecklistPanel title="Filtros de qualidade" subtitle="melhoram o score da entrada (até +30%)" items={qualityItems} values={quality} onToggle={(key) => toggle(quality, setQuality, key)} count={`+${qualityCount * 10}%`} />
              </div>
            </section>
            <section className="protocol-card">
              <div className="protocol-label">EXECUÇÃO E MÉTRICAS</div>
              <div className="protocol-grid four">
                <label>CONTRATOS INICIAIS<input type="number" min="0" value={inputValue(form.contracts)} onChange={(e) => update('contracts', e.target.value ? Number(e.target.value) : 0)} placeholder="0" /></label>
                <label>STOP ASSUMIDO (PTS)
                  <div className="neg-input-wrap">
                    <span className="neg-prefix">−</span>
                    <input type="number" step="any" min="0" value={form.stopLoss !== undefined ? Math.abs(form.stopLoss) : ''} onChange={(e) => update('stopLoss', e.target.value ? -Math.abs(Number(e.target.value)) : undefined)} placeholder="0" />
                  </div>
                </label>
                <label>MEN (CALOR) PTS
                  <div className="neg-input-wrap">
                    <span className="neg-prefix">−</span>
                    <input type="number" step="any" min="0" value={details.mae !== undefined ? Math.abs(details.mae) : ''} onChange={(e) => updateDetails('mae', e.target.value ? -Math.abs(Number(e.target.value)) : undefined)} placeholder="0" />
                  </div>
                </label>
                <label>MEP (FAVOR) PTS<input type="number" step="any" value={inputValue(details.mfe)} onChange={(e) => updateDetails('mfe', e.target.value ? Number(e.target.value) : undefined)} placeholder="0" /></label>
              </div>
              <div className="partial-heading"><span>SAÍDAS PARCIAIS</span><button type="button" onClick={addPartial}><Plus size={13} /> adicionar parcial</button></div>
              {partials.map((partial, index) => <div className="protocol-partial" key={index}><small>#{index + 1}</small><input type="number" step="any" value={inputValue(partial.points)} onChange={(e) => updatePartial(index, 'points', e.target.value ? Number(e.target.value) : 0)} placeholder="Pontos" /><input type="number" min="0" value={inputValue(partial.contracts)} onChange={(e) => updatePartial(index, 'contracts', e.target.value ? Number(e.target.value) : 0)} placeholder="Contratos" /><button type="button" onClick={() => removePartial(index)}><Trash2 size={14} /></button></div>)}
            </section>
            <section className="protocol-card lower-grid">
              <label className="protocol-label">OBSERVAÇÃO DA EXECUÇÃO<textarea value={form.note} onChange={(e) => update('note', e.target.value)} placeholder="Como foi a execução? O que você faria diferente?" /></label>
              <label className="protocol-label">CONTEXTO DO MERCADO<textarea value={details.marketContext ?? ''} onChange={(e) => updateDetails('marketContext', e.target.value)} placeholder="Notícias, abertura, fluxo e cenário..." /></label>
            </section>
          </div>
          <aside className="protocol-side">
            <section className="protocol-card summary-card"><div className="side-label">▥ RESUMO DA OPERAÇÃO</div><div className="summary-highlight"><div><small>RESULTADO FINANCEIRO</small><strong className={getToneClass(result)}>{money(result)}</strong></div><div><small>MÉDIA PONDERADA</small><strong>{weightedPoints.toFixed(1)} <em>pts</em></strong></div></div><div className="summary-row"><div><small>SALDO EM ABERTO</small><span>{Number(form.contracts) || 0} contratos</span></div><div><small>RISCO ASSUMIDO</small><span className="negative">{stopRisk ? `-R$ ${stopRisk.toFixed(2)}` : '—'}</span></div></div><small className="value-note">R$ {pointValue.toFixed(2)}/pt · cálculo automático</small></section>
            <section className="protocol-card emotion-card"><div className="side-label">ESTADO EMOCIONAL <span>(MÁX 3) · {selectedEmotion ? '1/3' : '0/3'}</span></div><div className="emotion-columns"><div><b className="positive">▲ positivas</b>{emotions.positive.map((emotion) => <button type="button" className={selectedEmotion === emotion ? 'emotion selected positive-bg' : 'emotion'} onClick={() => chooseEmotion(emotion)} key={emotion}>{emotion}</button>)}</div><div><b>• neutras</b>{emotions.neutral.map((emotion) => <button type="button" className={selectedEmotion === emotion ? 'emotion selected neutral-bg' : 'emotion'} onClick={() => chooseEmotion(emotion)} key={emotion}>{emotion}</button>)}</div><div><b className="negative">▼ negativas</b>{emotions.negative.map((emotion) => <button type="button" className={selectedEmotion === emotion ? 'emotion selected negative-bg' : 'emotion'} onClick={() => chooseEmotion(emotion)} key={emotion}>{emotion}</button>)}</div></div></section>
            <TradePrintUploader 
              imageUrl={details.imageUrl} 
              onUpload={(url) => updateDetails('imageUrl', url)} 
              onRemove={() => updateDetails('imageUrl', '')} 
            />
          </aside>
        </div>
        <div className="protocol-footer"><span><Shield size={14} /> Valor por ponto: R$ {pointValue.toFixed(2)} · Resultado calculado automaticamente</span><div><button type="button" className="outline-button" onClick={onClose}>Cancelar</button><button className="primary-button" type="submit"><Check size={16} /> Salvar operação</button></div></div>
      </form>
    </div>
  );
}

function ChecklistPanel({ title, subtitle, items, values, onToggle, count }: { title: string; subtitle: string; items: string[]; values: Checklist; onToggle: (key: string) => void; count: string }) {
  return <div className="checklist-panel"><div className="checklist-heading"><div><h3>{title}</h3><p>{subtitle}</p></div><b>{count}</b></div>{items.map((item) => <button type="button" className={values[item] ? 'check-item checked' : 'check-item'} onClick={() => onToggle(item)} key={item}><span>{values[item] ? <Check size={12} /> : null}</span>{item}</button>)}</div>;
}

export default TradeEntryModal;
