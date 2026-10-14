import { useState, useEffect } from 'react';
import { Sparkles, AlertCircle, CheckCircle2, ThumbsUp, AlertTriangle, TrendingUp, Calendar } from 'lucide-react';
import type { Trade } from '@/lib/types';

interface DiarySummaryProps {
  trades?: Trade[];
  observations: string;
  activeAccount?: string;
  periodLabel?: string;
}

export default function DiarySummary({ trades = [], observations, activeAccount, periodLabel = 'Período Atual' }: DiarySummaryProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ resumo: string; pontos_positivos?: string[]; desvios?: string[]; melhorias: string[] } | null>(null);
  const [error, setError] = useState('');
  const [errorType, setErrorType] = useState<'limit' | 'generic'>('generic');

  // Reseta a análise ao mudar de período ou lista de trades
  useEffect(() => {
    setResult(null);
    setError('');
  }, [periodLabel, trades.length]);

  const generateSummary = async () => {
    if (trades.length === 0) {
      setError(`Nenhuma operação encontrada no período selecionado (${periodLabel}).`);
      setErrorType('generic');
      return;
    }

    if (!observations.trim()) {
      setError(`As operações de ${periodLabel} não possuem anotações/reflexões registradas no diário.`);
      setErrorType('generic');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trades, observations, activeAccount, periodLabel }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        const mensagemErro = errorData?.error || `Falha ao conectar com o serviço de IA (HTTP ${res.status})`;
        if (res.status === 429) {
          setErrorType('limit');
          throw new Error(mensagemErro);
        }
        setErrorType('generic');
        throw new Error(mensagemErro);
      }

      const data = await res.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Erro desconhecido ao chamar a IA.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="stat-card" style={{ marginTop: '20px', gridColumn: '1 / -1', border: '1px solid #1a2220', background: 'linear-gradient(180deg, #111816, #0d1211)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={20} style={{ color: '#00e6a0' }} />
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Análise com Inteligência Artificial</h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', fontSize: '12px', color: '#8a9e97' }}>
            <Calendar size={13} style={{ color: '#00e6a0' }} />
            <span>Filtro ativo: <b style={{ color: '#e0e0e0' }}>{periodLabel}</b> ({trades.length} {trades.length === 1 ? 'operação' : 'operações'})</span>
          </div>
        </div>

        {!result && (
          <button
            onClick={generateSummary}
            disabled={loading || trades.length === 0}
            style={{
              background: trades.length === 0 ? '#1f2b27' : '#00e6a0',
              color: trades.length === 0 ? '#5d7970' : '#000',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '6px',
              fontWeight: 600,
              cursor: loading || trades.length === 0 ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '14px',
              transition: 'all 0.2s',
            }}
          >
            {loading ? (
              <>
                <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite', fontSize: 16 }}>⟳</span>
                Analisando {periodLabel}...
              </>
            ) : (
              `Analisar ${periodLabel}`
            )}
          </button>
        )}
      </div>

      {/* Mensagem de loading com dica */}
      {loading && (
        <div style={{ padding: '12px', background: 'rgba(0,230,160,0.07)', borderRadius: '6px', color: '#5d7970', fontSize: '13px', marginBottom: '16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <Sparkles size={15} style={{ color: '#00e6a0', flexShrink: 0 }} />
          <span>A IA está auditando estritamente as {trades.length} operações do período <b>{periodLabel}</b>...</span>
        </div>
      )}

      {/* Erro */}
      {error && (
        <div style={{ padding: '12px', background: errorType === 'limit' ? 'rgba(255,180,0,0.1)' : 'rgba(251,99,118,0.1)', color: errorType === 'limit' ? '#f5c543' : '#fb6376', borderRadius: '6px', display: 'flex', gap: '8px', alignItems: 'flex-start', marginBottom: '16px' }}>
          <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <span style={{ display: 'block' }}>{error}</span>
            {errorType === 'limit' && (
              <span style={{ display: 'block', marginTop: 4, fontSize: '12px', opacity: 0.8 }}>
                O modelo Flash-Lite tem limite de requisições por minuto. Aguarde 1-2 minutos e tente novamente.
              </span>
            )}
          </div>
        </div>
      )}

      {/* Resultado */}
      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Tag de período analisado */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 8px', background: 'rgba(0,230,160,0.1)', border: '1px solid rgba(0,230,160,0.2)', borderRadius: '4px', width: 'fit-content' }}>
            <Sparkles size={12} style={{ color: '#00e6a0' }} />
            <span style={{ fontSize: '11px', color: '#00e6a0', fontWeight: 600 }}>Auditoria exclusiva: {periodLabel} ({trades.length} ops)</span>
          </div>

          {/* Resumo geral */}
          <div>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#5d7970', fontWeight: 600 }}>Resumo do Período</span>
            <p style={{ marginTop: '8px', lineHeight: 1.6, color: '#e0e0e0', fontSize: '14px' }}>
              {result.resumo}
            </p>
          </div>

          {/* Pontos positivos */}
          {result.pontos_positivos && result.pontos_positivos.length > 0 && (
            <div style={{ borderTop: '1px solid #1a2220', paddingTop: '16px' }}>
              <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#5d7970', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, marginBottom: '12px' }}>
                <ThumbsUp size={13} style={{ color: '#00e6a0' }} /> Pontos Positivos
              </span>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {result.pontos_positivos.map((item, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '14px', color: '#e0e0e0', lineHeight: 1.5 }}>
                    <CheckCircle2 size={16} style={{ color: '#00e6a0', marginTop: '3px', flexShrink: 0 }} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Desvios */}
          {result.desvios && result.desvios.length > 0 && (
            <div style={{ borderTop: '1px solid #1a2220', paddingTop: '16px' }}>
              <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#5d7970', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, marginBottom: '12px' }}>
                <AlertTriangle size={13} style={{ color: '#f5c543' }} /> Desvios do Operacional
              </span>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {result.desvios.map((item, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '14px', color: '#e0e0e0', lineHeight: 1.5 }}>
                    <AlertTriangle size={16} style={{ color: '#f5c543', marginTop: '3px', flexShrink: 0 }} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Melhorias */}
          {result.melhorias && result.melhorias.length > 0 && (
            <div style={{ borderTop: '1px solid #1a2220', paddingTop: '16px' }}>
              <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#5d7970', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, marginBottom: '12px' }}>
                <TrendingUp size={13} style={{ color: '#7c9ef5' }} /> Pontos de Melhoria
              </span>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {result.melhorias.map((item, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '14px', color: '#e0e0e0', lineHeight: 1.5 }}>
                    <TrendingUp size={16} style={{ color: '#7c9ef5', marginTop: '3px', flexShrink: 0 }} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
            <button
              onClick={() => setResult(null)}
              style={{ background: 'transparent', border: '1px solid #283330', color: '#8a9e97', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}
            >
              Limpar / Analisar Novamente
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
