// api/summarize.js
// Serverless function da Vercel — roda no servidor, nunca no navegador.
// Recebe os trades e observações do usuário e devolve uma análise
// comparando a execução com o operacional definido, usando a API do Gemini.

// Dá mais tempo pra função quando precisar tentar mais de um modelo.
// (O padrão da Vercel pode ser curto demais pra 2-3 chamadas seguidas.)
export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { trades, observations, activeAccount } = req.body;
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
- OVERTRADING: mais de 5 operações no mesmo dia é overtrading. Sinalizar sempre como desvio grave, independente do resultado.

7. SAÍDAS
- Parcial em 1:1 quase obrigatória em região de trava com mercado andado. Resto sai em trava/médias/topos/resistências.

8. STOP
- Só move com nova estrutura confirmada (novo fundo/topo), nunca só por estar positivo.
- Não encerra loss manualmente antes do stop, salvo exceção rara.

9. NOTÍCIAS
- 3 estrelas: evitar iniciar operação no momento. Se já posicionado, pode manter.

10. EMOCIONAL
- Pode-se registrar até 3 estados emocionais na operação.
- Emoções negativas (ansioso, irritado, impulsivo, vingativo, com medo) ou estar abalado por motivo pessoal = evitar operar.

11. DISCIPLINA
- 2 losses seguidos = parar (exceto se ambos pequenos, permite 3ª tentativa). 3 losses seguidos = encerra o dia.
- Encerra também ao bater meta ou após movimento muito grande.

12. FILTROS DE QUALIDADE TÉCNICA
- Avaliam a confluência da operação: Região de médias ou Afastado das médias, Região de fibo, Suporte ou Resistência.
- Quanto mais filtros a operação possuir, maior a % de qualidade técnica da entrada e mais embasada ela está.

PRINCÍPIO: o operacional não muda por gain ou loss. Avalie o processo, nunca o resultado.
`;

  const accountContext = activeAccount ? `\nCONTA ANALISADA: ${activeAccount}\n` : '';

  const prompt = `Você é um analista de trading auditando a EXECUÇÃO de um trader — não o resultado financeiro.
${accountContext}
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

  // ==========================================================================
  // MODELOS — ordem de preferência. Se um estiver sobrecarregado (503),
  // sem cota (429) ou indisponível (404), a função cai pro próximo da lista
  // em vez de falhar. Pra trocar/adicionar modelos, mexa só aqui.
  // ==========================================================================
  const MODELOS = ['gemini-3.6-flash', 'gemini-3.8-flash', 'gemini-3.7-flash'];
  const TENTATIVAS_POR_MODELO = 2; // só usadas em caso de 503 (sobrecarga temporária)
  const ESPERA_ENTRE_TENTATIVAS_MS = 1500;

  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.2, // baixo: menos "criatividade", mais aderência literal às regras
      maxOutputTokens: 8192, // margem folgada: modelos 3.x gastam tokens "pensando" antes de responder
      responseMimeType: 'application/json', // força JSON nativo: resposta sempre parseável
    },
  });

  let response;
  let errText = '';
  let lastStatus = null;

  try {
    outer: for (const model of MODELOS) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;

      for (let tentativa = 1; tentativa <= TENTATIVAS_POR_MODELO; tentativa++) {
        response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        });

        if (response.ok) {
          console.log(`Resumo gerado com o modelo ${model}`);
          break outer;
        }

        errText = await response.text();
        lastStatus = response.status;
        console.error(`[${model}] tentativa ${tentativa} falhou (${response.status}):`, errText);

        // 503 = sobrecarga temporária: espera um pouco e tenta de novo no mesmo modelo.
        if (response.status === 503 && tentativa < TENTATIVAS_POR_MODELO) {
          await new Promise((r) => setTimeout(r, ESPERA_ENTRE_TENTATIVAS_MS));
          continue;
        }

        // 429 (cota), 404 (modelo indisponível) ou 503 persistente: vai pro próximo modelo.
        break;
      }
    }

    // Nenhum modelo funcionou
    if (!response || !response.ok) {
      if (lastStatus === 429) {
        return res.status(429).json({
          error: 'Cota da IA esgotada. Tente novamente mais tarde.',
          googleError: errText,
        });
      }
      if (lastStatus === 404) {
        return res.status(502).json({
          error: 'Os modelos de IA configurados não estão mais disponíveis. Atualize a lista MODELOS no código.',
          googleError: errText,
        });
      }
      return res.status(502).json({
        error: 'A IA está sobrecarregada no momento. Tente de novo em instantes.',
        googleError: errText,
      });
    }

    const data = await response.json();
    const candidate = data?.candidates?.[0];
    const rawText = candidate?.content?.parts?.[0]?.text ?? '';
    const finishReason = candidate?.finishReason;
    // Com responseMimeType 'application/json' o Gemini não deveria mais mandar
    // cercas de markdown, mas removemos por segurança caso ele volte a fazer isso.
    const cleaned = rawText.replace(/```json|```/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      // A resposta veio truncada ou em formato inesperado — nunca jogar o
      // texto bruto (que pode ter chaves/aspas soltas) direto pro usuário.
      console.error('JSON inválido do Gemini. finishReason:', finishReason, 'raw:', rawText);
      const motivo =
        finishReason === 'MAX_TOKENS'
          ? 'A resposta da IA foi cortada por exceder o limite de tokens.'
          : 'A IA retornou um formato inesperado.';
      return res.status(502).json({
        error: `Não foi possível gerar o resumo. ${motivo} Tente novamente.`,
      });
    }

    return res.status(200).json(parsed);
  } catch (err) {
    console.error('Erro ao gerar resumo:', err);
    return res.status(500).json({ error: 'Erro interno ao gerar o resumo' });
  }
}
