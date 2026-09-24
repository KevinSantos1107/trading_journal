import { useState } from 'react';
import { Check, Plus, Trash2, X, Zap, Filter, Settings2, AlertTriangle } from 'lucide-react';
import type { OperationalConfig, AssetConfig } from '@/lib/types';
import { STRATEGIES as DEFAULT_STRATEGIES } from '@/lib/calc';

const DEFAULT_QUALITY_FILTERS = [
  'Região de média ou Afastado das médias',
  'Região de fibo',
  'Suporte ou Resistência',
];

const DEFAULT_ASSETS: AssetConfig[] = [
  { name: 'Mini Índice', pointValue: 0.20 },
  { name: 'Mini Dólar', pointValue: 10.00 }
];

type Props = {
  isFirstAccess: boolean;
  initialConfig?: OperationalConfig | null;
  onSave: (config: OperationalConfig) => void;
  onSkip?: () => void;
  onClose?: () => void;
};

export default function OperationalSetupModal({ isFirstAccess, initialConfig, onSave, onSkip, onClose }: Props) {
  const [strategies, setStrategies] = useState<string[]>(
    initialConfig?.strategies?.length ? initialConfig.strategies : [...DEFAULT_STRATEGIES]
  );
  const [qualityFilters, setQualityFilters] = useState<string[]>(
    initialConfig?.qualityFilters?.length ? initialConfig.qualityFilters : [...DEFAULT_QUALITY_FILTERS]
  );
  const [assets, setAssets] = useState<AssetConfig[]>(
    initialConfig?.assets?.length ? initialConfig.assets : [...DEFAULT_ASSETS]
  );
  const [newStrategy, setNewStrategy] = useState('');
  const [newFilter, setNewFilter] = useState('');
  
  const [newAssetName, setNewAssetName] = useState('');
  const [newAssetPointValue, setNewAssetPointValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<'intro' | 'strategies' | 'filters' | 'done'>(
    isFirstAccess ? 'intro' : 'strategies'
  );

  const addStrategy = () => {
    const trimmed = newStrategy.trim();
    if (!trimmed || strategies.includes(trimmed)) return;
    setStrategies([...strategies, trimmed]);
    setNewStrategy('');
  };

  const removeStrategy = (idx: number) => {
    if (strategies.length <= 1) return;
    setStrategies(strategies.filter((_, i) => i !== idx));
  };

  const addFilter = () => {
    const trimmed = newFilter.trim();
    if (!trimmed || qualityFilters.includes(trimmed)) return;
    setQualityFilters([...qualityFilters, trimmed]);
    setNewFilter('');
  };

  const removeFilter = (idx: number) => {
    if (qualityFilters.length <= 1) return;
    setQualityFilters(qualityFilters.filter((_, i) => i !== idx));
  };

  const addAsset = () => {
    const nameTrimmed = newAssetName.trim();
    const pointVal = parseFloat(newAssetPointValue.replace(',', '.'));
    
    if (!nameTrimmed || isNaN(pointVal) || pointVal <= 0) {
      alert('Preencha o nome do ativo e um valor por ponto válido maior que zero.');
      return;
    }
    if (assets.some(a => a.name.toLowerCase() === nameTrimmed.toLowerCase())) {
      alert('Um ativo com este nome já existe.');
      return;
    }
    
    setAssets([...assets, { name: nameTrimmed, pointValue: pointVal }]);
    setNewAssetName('');
    setNewAssetPointValue('');
  };

  const removeAsset = (idx: number) => {
    if (assets.length <= 1) return;
    setAssets(assets.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (strategies.length === 0) {
      alert('Adicione pelo menos uma estratégia/setup operacional.');
      return;
    }
    if (qualityFilters.length === 0) {
      alert('Adicione pelo menos um filtro de qualidade.');
      return;
    }
    if (assets.length === 0) {
      alert('Adicione pelo menos um ativo operado.');
      return;
    }
    setSaving(true);
    try {
      await onSave({ strategies, qualityFilters, assets });
      if (isFirstAccess) setStep('done');
    } finally {
      setSaving(false);
    }
  };

  /* ── INTRO STEP (first access only) ── */
  if (step === 'intro') {
    return (
      <div className="modal-backdrop">
        <div className="opsm-modal opsm-intro">
          <div className="opsm-intro-badge">
            <Zap size={28} />
          </div>
          <h2>Bem-vindo ao TradeLog</h2>
          <p className="opsm-intro-desc">
            Antes de começar, vamos configurar seu <strong>operacional</strong>.<br />
            Defina suas estratégias e filtros de entrada para que o diário seja totalmente personalizado para você.
          </p>
          <div className="opsm-intro-bullets">
            <div className="opsm-bullet">
              <div className="opsm-bullet-icon"><Zap size={16} /></div>
              <div>
                <strong>Estratégias / Setups</strong>
                <span>Os setups que você executa no mercado</span>
              </div>
            </div>
            <div className="opsm-bullet">
              <div className="opsm-bullet-icon"><Filter size={16} /></div>
              <div>
                <strong>Filtros de Qualidade</strong>
                <span>Critérios de validação que uma entrada deve ter</span>
              </div>
            </div>
          </div>
          <div className="opsm-intro-actions">
            <button className="primary-button" style={{ flex: 1 }} onClick={() => setStep('strategies')}>
              Configurar agora
            </button>
            {onSkip && (
              <button className="outline-button" onClick={onSkip}>
                Pular por enquanto
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ── DONE STEP (first access only) ── */
  if (step === 'done') {
    return (
      <div className="modal-backdrop">
        <div className="opsm-modal opsm-intro">
          <div className="opsm-intro-badge" style={{ background: 'rgba(0,232,138,.15)', color: '#00E88A' }}>
            <Check size={28} />
          </div>
          <h2>Operacional configurado!</h2>
          <p className="opsm-intro-desc">
            Suas estratégias e filtros foram salvos com sucesso.<br />
            Você pode alterar essas configurações a qualquer momento pelo menu de perfil.
          </p>
          <div className="opsm-done-summary">
            <div>
              <strong>{strategies.length}</strong>
              <span>Setups configurados</span>
            </div>
            <div>
              <strong>{qualityFilters.length}</strong>
              <span>Filtros de qualidade</span>
            </div>
          </div>
          <button className="primary-button" style={{ width: '100%' }} onClick={onClose ?? onSkip}>
            Começar a usar o TradeLog
          </button>
        </div>
      </div>
    );
  }

  /* ── MAIN EDITING UI ── */
  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && !isFirstAccess && onClose?.()}>
      <div className="opsm-modal opsm-main">
        {/* Header */}
        <div className="opsm-header">
          <div>
            <div className="eyebrow"><span className="green-dot" /> OPERACIONAL</div>
            <h2>{isFirstAccess ? 'Configurar Operacional' : 'Configurações do Operacional'}</h2>
            <p>Defina seus setups e filtros de qualidade de entrada</p>
          </div>
          {!isFirstAccess && onClose && (
            <button className="icon-button" onClick={onClose}><X size={18} /></button>
          )}
        </div>

        <div className="opsm-body">
          {/* Assets Section */}
          <div className="opsm-section">
            <div className="opsm-section-header">
              <div className="opsm-section-title">
                <Zap size={15} />
                <span>Ativos Operados</span>
              </div>
              <span className="opsm-count">{assets.length} ativo{assets.length !== 1 ? 's' : ''}</span>
            </div>
            <p className="opsm-section-desc">
              Os ativos que você costuma operar. Defina o nome e quanto vale cada ponto.
            </p>

            <div className="opsm-items-list">
              {assets.map((a, idx) => (
                <div key={idx} className="opsm-item">
                  <div className="opsm-item-icon" style={{ background: 'rgba(0, 232, 138, 0.1)', color: '#00E88A' }}>
                    <span style={{ fontSize: 11, fontWeight: 'bold' }}>$</span>
                  </div>
                  <span className="opsm-item-text" style={{ flex: 1 }}>{a.name}</span>
                  <span style={{ fontSize: 12, color: '#9a9390', marginRight: 10 }}>R$ {a.pointValue.toFixed(2)}/pt</span>
                  <button
                    type="button"
                    className="opsm-item-remove"
                    onClick={() => removeAsset(idx)}
                    disabled={assets.length <= 1}
                    title={assets.length <= 1 ? 'Mantenha ao menos um ativo' : 'Remover'}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>

            <div className="opsm-add-row" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: 8 }}>
              <input
                type="text"
                placeholder="Nome, ex: Mini Índice"
                value={newAssetName}
                onChange={e => setNewAssetName(e.target.value)}
                maxLength={40}
              />
              <input
                type="number"
                step="any"
                min="0"
                placeholder="R$/pt, ex: 0.20"
                value={newAssetPointValue}
                onChange={e => setNewAssetPointValue(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addAsset())}
              />
              <button
                type="button"
                className="primary-button"
                onClick={addAsset}
                disabled={!newAssetName.trim() || !newAssetPointValue.trim()}
              >
                <Plus size={15} /> Adicionar
              </button>
            </div>

            {assets.length === 0 && (
              <div className="opsm-warning">
                <AlertTriangle size={14} /> Adicione pelo menos um ativo para continuar.
              </div>
            )}
          </div>

          <div className="opsm-divider" />

          {/* Strategies Section */}
          <div className="opsm-section">
            <div className="opsm-section-header">
              <div className="opsm-section-title">
                <Zap size={15} />
                <span>Estratégias / Setups Operacionais</span>
              </div>
              <span className="opsm-count">{strategies.length} setup{strategies.length !== 1 ? 's' : ''}</span>
            </div>
            <p className="opsm-section-desc">
              Os setups que você opera no mercado. Eles aparecem no registro de cada operação para classificar suas entradas.
            </p>

            <div className="opsm-items-list">
              {strategies.map((s, idx) => (
                <div key={idx} className="opsm-item">
                  <div className="opsm-item-icon"><Zap size={13} /></div>
                  <span className="opsm-item-text">{s}</span>
                  <button
                    type="button"
                    className="opsm-item-remove"
                    onClick={() => removeStrategy(idx)}
                    disabled={strategies.length <= 1}
                    title={strategies.length <= 1 ? 'Mantenha ao menos uma estratégia' : 'Remover'}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>

            <div className="opsm-add-row">
              <input
                type="text"
                placeholder="Nome do setup, ex: Price Action na Máxima..."
                value={newStrategy}
                onChange={e => setNewStrategy(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addStrategy())}
                maxLength={80}
              />
              <button
                type="button"
                className="primary-button"
                onClick={addStrategy}
                disabled={!newStrategy.trim()}
              >
                <Plus size={15} /> Adicionar
              </button>
            </div>

            {strategies.length === 0 && (
              <div className="opsm-warning">
                <AlertTriangle size={14} /> Adicione pelo menos uma estratégia para continuar.
              </div>
            )}
          </div>

          <div className="opsm-divider" />

          {/* Quality Filters Section */}
          <div className="opsm-section">
            <div className="opsm-section-header">
              <div className="opsm-section-title">
                <Filter size={15} />
                <span>Filtros de Qualidade da Entrada</span>
              </div>
              <span className="opsm-count">{qualityFilters.length} filtro{qualityFilters.length !== 1 ? 's' : ''}</span>
            </div>
            <p className="opsm-section-desc">
              Critérios técnicos que uma entrada precisa satisfazer. Cada filtro marcado adiciona pontuação de confluência no registro da operação.
            </p>

            <div className="opsm-items-list">
              {qualityFilters.map((f, idx) => (
                <div key={idx} className="opsm-item">
                  <div className="opsm-item-icon filter"><Check size={13} /></div>
                  <span className="opsm-item-text">{f}</span>
                  <button
                    type="button"
                    className="opsm-item-remove"
                    onClick={() => removeFilter(idx)}
                    disabled={qualityFilters.length <= 1}
                    title={qualityFilters.length <= 1 ? 'Mantenha ao menos um filtro' : 'Remover'}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>

            <div className="opsm-add-row">
              <input
                type="text"
                placeholder="Ex: Próximo de média exponencial 9..."
                value={newFilter}
                onChange={e => setNewFilter(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addFilter())}
                maxLength={80}
              />
              <button
                type="button"
                className="primary-button"
                onClick={addFilter}
                disabled={!newFilter.trim()}
              >
                <Plus size={15} /> Adicionar
              </button>
            </div>

            {qualityFilters.length === 0 && (
              <div className="opsm-warning">
                <AlertTriangle size={14} /> Adicione pelo menos um filtro para continuar.
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="opsm-footer">
          {!isFirstAccess && onClose && (
            <button className="outline-button" onClick={onClose}>Cancelar</button>
          )}
          {isFirstAccess && onSkip && (
            <button className="outline-button" onClick={onSkip}>Pular</button>
          )}
          <button
            className="primary-button"
            onClick={handleSave}
            disabled={saving || strategies.length === 0 || qualityFilters.length === 0}
            style={{ flex: 1 }}
          >
            {saving ? (
              <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Salvando...</>
            ) : (
              <><Settings2 size={15} /> {isFirstAccess ? 'Salvar e Continuar' : 'Salvar Configurações'}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
