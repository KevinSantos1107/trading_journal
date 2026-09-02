// api/summarize.js
// Serverless function da Vercel — roda no servidor, nunca no navegador.
// Recebe os trades e observações do usuário e devolve uma análise
// comparando a execução com o operacional definido, usando a API do Gemini.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { trades, observations } = req.body;
  if (!observations || observations.trim().length === 0) {
    return res.status(400).json({ error: 'Nenhuma observação fornecida' });
  }

  // ==========================================================================
  // OPERACIONAL — versão enxuta. Regras curtas e diretas, sem explicação
  // redundante, pra IA não ter espaço/motivo pra "inventar" texto em cima.
  // ==========================================================================
  const MEU_OPERACIONAL = `
1. HORÁRIO
- Opera das 9h às 11h. Depois das 11h, não opera.

2. ENTRADA NA ABERTURA
- Com notícia: região propícia + macro a favor = prioridade máxima. Notícia é combustível extra.
- Sem notícia: analisar o Trio (VIX, petróleo, minério). Região boa = mais tranquilo. Região duvidosa = mais cautela.

3. ENTRADA FORA DA ABERTURA (extremidade)
- Contra a tendência: mercado esticado das médias + confluência (topo, fundo, médias, fibo) = válido, mas exige mais cautela.
- A favor da tendência: mesma exigência de confluência, porém mais segura.

4. REGIÕES VÁLIDAS
- Suporte, resistência, troca de polaridade, 50%, 61%, 76,2%, MME9, MMA20, MMA50, MMA200, MME200. Mais confluência é melhor.
- Pullback é região válida quando: análise macro (tempos gráficos maiores) alinhada com a tendência + micro (5min) também alinhado + o preço retorna e toca no mínimo a MME9 (pode ir até MMA20/MMA50, nunca menos) com as médias alinhadas entre si. Faltando macro, micro ou o toque nas médias = não é região válida.

5. GESTÃO DE RISCO
- Stop curto, nas extremidades da estrutura. Mais pontos de stop = menos contratos, e vice-versa.
- Mão: baixa (abertura), padrão (dia normal), máxima (dia muito bom / após gain / semana boa).

6. QUANTIDADE
- Ideal 1-2 no dia, evitar passar de 3. Máximo excepcional: 5.

7. SAÍDAS
- Parcial em 1:1 quase obrigatória em região de trava com mercado andado. Resto sai em trava/médias/topos/resistências.

8. STOP
- Só move com nova estrutura confirmada (novo fundo/topo), nunca só por estar positivo.
- Não encerra loss manualmente antes do stop, salvo exceção rara.

9. NOTÍCIAS
- 3 estrelas: evitar iniciar operação no momento. Se já posicionado, pode manter.

10. EMOCIONAL
- Abalado por motivo pessoal = evitar operar.

11. DISCIPLINA
- 2 losses seguidos = parar (exceto se ambos pequenos, permite 3ª tentativa). 3 losses seguidos = encerra o dia.
- Encerra também ao bater meta ou após movimento muito grande.

PRINCÍPIO: o operacional não muda por gain ou loss. Avalie o processo, nunca o resultado.
`;

  const prompt = `Você é um analista de trading auditando a EXECUÇÃO de um trader — não o resultado financeiro.

OPERACIONAL DO TRADER:
${MEU_OPERACIONAL}

TRADES:
${JSON.stringify(trades ?? [], null, 2)}

OBSERVAÇÕES DO TRADER:
${observations}

INSTRUÇÕES:
- Julgue cada trade estritamente pela aderência ao operacional acima. Nunca pelo resultado (gain/loss).
- Não invente informação que não está nos trades ou nas observações. Se faltar dado pra avaliar uma regra, diga "dados insuficientes" em vez de supor.
- Seja direto e curto em cada item — uma frase, sem floreio. Cite o trade (ativo/horário) em cada ponto.
- Não repita a mesma constatação em pontos_positivos e desvios.

Responda APENAS com um JSON válido (sem markdown, sem texto fora do JSON):
{
  "resumo": "2-3 frases: contexto do dia e conclusão geral sobre aderência ao operacional",
  "pontos_positivos": ["frase curta, citando o trade"],
  "desvios": ["frase curta, citando o trade"],
  "melhorias": ["sugestão curta e prática"]
}`;

  const model = 'gemini-3.8-flash'; // modelo estável com cota gratuita generosa (~1000 req/dia)
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;
  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.2, // baixo: menos "criatividade", mais aderência literal às regras
      maxOutputTokens: 900, // reduzido de propósito: força respostas curtas, sem enrolação
    },
  });

  // Tenta de novo só em caso de sobrecarga temporária (503).
  // Em caso de cota diária esgotada (429), tentar de novo não resolve — só espera até amanhã.
  const MAX_TENTATIVAS = 2;
  let response, errText;

  try {
    for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });

      if (response.ok) break;

      errText = await response.text();

      if (response.status === 429) {
        console.error('Cota do Gemini esgotada:', errText);
        return res.status(429).json({
          error: 'Cota gratuita do dia esgotada. Tente novamente mais tarde.',
        });
      }

      const sobrecarregado = response.status === 503;
      if (!sobrecarregado || tentativa === MAX_TENTATIVAS) {
        console.error('Erro da API Gemini:', errText);
        return res.status(502).json({ error: 'Falha ao consultar a IA', detalhe: errText });
      }

      await new Promise((r) => setTimeout(r, tentativa * 500));
    }

    const data = await response.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const cleaned = rawText.replace(/```json|```/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      // fallback caso o modelo não retorne um JSON perfeito
      parsed = { resumo: rawText, pontos_positivos: [], desvios: [], melhorias: [] };
    }

    return res.status(200).json(parsed);
  } catch (err) {
    console.error('Erro ao gerar resumo:', err);
    return res.status(500).json({ error: 'Erro interno ao gerar o resumo' });
  }
}
