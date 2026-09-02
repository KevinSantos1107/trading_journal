import { useState } from 'react';
import { Sparkles, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { Trade } from '@/lib/types';

interface DiarySummaryProps {
  trades?: Trade[];
  observations: string;
}

export default function DiarySummary({ trades = [], observations }: DiarySummaryProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ resumo: string; melhorias: string[] } | null>(null);
  const [error, setError] = useState('');

  const generateSummary = async () => {
    if (!observations.trim()) {
      setError('Escreva alguma observação no diário antes de gerar o resumo com a IA.');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const res = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trades, observations }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error("Detalhes do erro do servidor:", errorText);
        throw new Error(`Falha ao gerar o resumo. Código: ${res.status}. Veja o console para detalhes.`);
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={20} style={{ color: '#00e6a0' }} />
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Análise com Inteligência Artificial</h3>
        </div>
        {!result && (
          <button 
            onClick={generateSummary} 
            disabled={loading}
            style={{
              background: '#00e6a0',
              color: '#000',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '6px',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            {loading ? 'Analisando...' : 'Gerar Resumo com IA'}
          </button>
        )}
      </div>

      {error && (
        <div style={{ padding: '12px', background: 'rgba(251, 99, 118, 0.1)', color: '#fb6376', borderRadius: '6px', display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '16px' }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#5d7970', fontWeight: 600 }}>Resumo do Dia</span>
            <p style={{ marginTop: '8px', lineHeight: 1.6, color: '#e0e0e0', fontSize: '14px' }}>
              {result.resumo}
            </p>
          </div>
          
          {result.melhorias && result.melhorias.length > 0 && (
            <div style={{ borderTop: '1px solid #1a2220', paddingTop: '16px' }}>
              <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#5d7970', fontWeight: 600, display: 'block', marginBottom: '12px' }}>Pontos de Melhoria</span>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {result.melhorias.map((item, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '14px', color: '#e0e0e0', lineHeight: 1.5 }}>
                    <CheckCircle2 size={16} style={{ color: '#00e6a0', marginTop: '3px', flexShrink: 0 }} />
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
              Limpar / Gerar Novamente
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
