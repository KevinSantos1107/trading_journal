// api/summarize.js
// Serverless function da Vercel — Executada em Node.js no servidor.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido. Utilize POST.' });
  }

  const { trades, observations } = req.body || {};

  if (!observations || typeof observations !== 'string' || observations.trim().length === 0) {
    return res.status(400).json({ error: 'Nenhuma observação do trader foi fornecida.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('ERRO: GEMINI_API_KEY não configurada nas variáveis de ambiente da Vercel.');
    return res.status(500).json({ error: 'Chave de API não configurada no servidor.' });
  }

  // ==========================================================================
  // OPERACIONAL DO TRADER (System Instruction)
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

PRINCÍPIO FUNDAMENTAL: O operacional não muda por gain ou loss. Audite o processo, nunca o resultado financeiro.
`;

  const systemInstruction = `Você é um auditor rigoroso de trading focado EXCLUSIVAMENTE na EXECUÇÃO e disciplina do trader.
REGRAS DO OPERACIONAL:
${MEU_OPERACIONAL}

DIRETRIZES DE AUDITORIA:
- Julgue cada trade estritamente pela aderência ao operacional. Jamais pelo resultado de gain ou loss.
- Não invente informações. Se faltarem dados para validar uma regra (ex: tempo gráfico, toque em média), declare "dados insuficientes".
- Seja direto, conciso e cirúrgico (máximo 1 frase por item). Cite o ativo/horário do trade em cada ponto.
- Não duplique observações entre pontos positivos e desvios.`;

  const userContent = `TRADES DO DIA:\n${JSON.stringify(trades ?? [], null, 2)}\n\nOBSERVAÇÕES DO TRADER:\n${observations.trim()}`;

  // Configuração com Structured JSON Schema (garante JSON sem markdown)
  const requestBody = {
    system_instruction: {
      parts: [{ text: systemInstruction }]
    },
    contents: [
      {
        role: 'user',
        parts: [{ text: userContent }]
      }
    ],
    generationConfig: {
      temperature: 0.1, // Quase determinístico: auditoria pura
      maxOutputTokens: 1024,
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          resumo: {
            type: 'STRING',
            description: '2 a 3 frases sintetizando o contexto e a nota geral de aderência ao plano.'
          },
          pontos_positivos: {
            type: 'ARRAY',
            items: { type: 'STRING' },
            description: 'Frases curtas citando o trade/horário onde o plano foi seguido com excelência.'
          },
          desvios: {
            type: 'ARRAY',
            items: { type: 'STRING' },
            description: 'Frases curtas citando o trade/horário onde houve quebra ou negligência do plano.'
          },
          melhorias: {
            type: 'ARRAY',
            items: { type: 'STRING' },
            description: 'Sugestões práticas e diretas para o próximo pregão.'
          }
        },
        required: ['resumo', 'pontos_positivos', 'desvios', 'melhorias']
      }
    }
  };

  // Modelo: gemini-3.1-flash-lite (rápido, cota ampla e baixíssima latência)
  const MODEL = 'gemini-3.1-flash-lite';
  const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;

  const MAX_RETRIES = 3;
  let lastErrorText = '';
  let lastStatus = 500;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      // AbortController para prevenir que a Vercel mate a função por timeout silencioso (erro 520)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 segundos

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        const outputJsonText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!outputJsonText) {
          throw new Error('Resposta da IA veio vazia.');
        }

        const parsed = JSON.parse(outputJsonText);
        return res.status(200).json(parsed);
      }

      lastStatus = response.status;
      lastErrorText = await response.text();

      // Tratamento de 429 (Rate Limit por minuto vs Cota Diária)
      if (lastStatus === 429) {
        console.warn(`[Tentativa ${attempt}/${MAX_RETRIES}] Rate limit 429 atingido. Aguardando recarga...`);
        if (attempt === MAX_RETRIES) {
          return res.status(429).json({
            error: 'Muitas requisições simultâneas ou cota atingida. Aguarde 30 segundos e tente novamente.'
          });
        }
        // Espera 2.5s na 1ª e 5s na 2ª antes de desistir
        await new Promise((resolve) => setTimeout(resolve, attempt * 2500));
        continue;
      }

      // Tratamento de erros de gateway / instabilidade (500, 502, 503, 520)
      if ([500, 502, 503, 504, 520].includes(lastStatus)) {
        console.warn(`[Tentativa ${attempt}/${MAX_RETRIES}] Erro de servidor (${lastStatus}). Tentando novamente...`);
        if (attempt === MAX_RETRIES) break;
        await new Promise((resolve) => setTimeout(resolve, attempt * 1200));
        continue;
      }

      // Erros 400 ou 403 (chave inválida ou payload errado) — não adianta tentar de novo
      console.error(`Erro definitivo do Gemini (${lastStatus}):`, lastErrorText);
      return res.status(lastStatus).json({
        error: 'Erro na requisição para o modelo de IA.',
        detalhe: lastErrorText
      });

    } catch (err) {
      console.error(`Exceção na tentativa ${attempt}:`, err?.message || err);
      if (attempt === MAX_RETRIES) {
        return res.status(504).json({
          error: 'Tempo limite excedido ao processar a auditoria com a IA. Tente novamente.'
        });
      }
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }

  return res.status(lastStatus || 502).json({
    error: 'Não foi possível obter resposta da IA após várias tentativas.',
    detalhe: lastErrorText
  });
}
