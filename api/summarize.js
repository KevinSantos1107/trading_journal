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
  // ESQUEMA ESPERADO DE CADA TRADE (ajuste os nomes de campo se o seu formulário
  // usar outros — o que importa é que o prompt abaixo referencia estes nomes
  // explicitamente, então eles precisam bater com o que o front-end envia).
  //
  // {
  //   data: "2025-06-10",
  //   ativo: "WINM25",
  //   horario_entrada: "09:01",
  //   contexto: "abertura" | "fora_abertura",
  //   direcao: "compra" | "venda",
  //   regiao_entrada: "suporte diário + MME9 5min",
  //   pullback: {
  //     usado: true,
  //     alinhado_tendencia: true,
  //     tocou_mme9_5min: true,
  //     medias_alinhadas_5min: true
  //   } | null,           // null se a entrada não foi via pullback
  //   gatilho: "martelo 1min" | "virada de candle" | "barra de força" | ...,
  //   combustivel: { noticia_9h: "sim/não/qual", trio: "favorável/neutro/contra" },
  //   mao: "baixa" | "padrao" | "maxima",
  //   stop_pontos: 120,
  //   contratos: 2,
  //   parcial_1_1: true,
  //   stop_movido: "não" | "sim, motivo: novo fundo confirmado no 5min",
  //   saida_manual_antecipada: false,
  //   resultado: "gain" | "loss"   // NUNCA usado para julgar processo, só para contexto
  // }
  // ==========================================================================

  // ==========================================================================
  // OPERACIONAL — reescrito como checklist nomeado. Cada regra aponta pro
  // campo de dado que a IA deve consultar, para reduzir julgamento genérico
  // ou inferido sem base.
  // ==========================================================================
  const MEU_OPERACIONAL = `
1. ATIVOS E HORÁRIOS
- Campo: ativo, horario_entrada.
- Ativo principal: WIN (mini-índice), mas pode ser aplicado a qualquer ativo.
- Janela operacional: 09:00–11:00. horario_entrada > 11:00 é desvio automático.
- horario_entrada no primeiro minuto do pregão é permitido (contexto = "abertura").

2. LEITURA DE MERCADO E CONTEXTO
- Campo: combustivel.
- Leitura de cima para baixo: Semanal → Diário → 60min → 15min → 5min → 2min → 1min (5min/2min = leitura/confirmação, 1min = execução).
- "Combustível" = notícia relevante às 9h (combustivel.noticia_9h) + Trio VIX/petróleo/minério (combustivel.trio).
- Com combustível favorável, a leitura direcional é mais clara. Sem combustível e trio neutro, abertura é mais arriscada mas não proibida, se regiao_entrada for válida.

3. REGIÕES VÁLIDAS
- Campo: regiao_entrada, pullback.
- Regiões válidas: suporte, resistência, troca de polaridade, 50%, 61%, 76,2%, MME9, MMA20, MMA50, MMA200, MME200. Sem hierarquia fixa A/B/C — mais confluência é melhor.
- REGRA DO PULLBACK (só conta como região válida se pullback.usado = true E as 3 condições abaixo forem true SIMULTANEAMENTE):
  a) pullback.alinhado_tendencia = true
  b) pullback.tocou_mme9_5min = true (mínimo a MME9; pode ir até MMA20/MMA50, nunca menos)
  c) pullback.medias_alinhadas_5min = true (MME9/MMA20/MMA50 alinhadas na direção da tendência)
- Se qualquer uma das três for false, null ou não informada: pullback NÃO é região válida — reportar isso como "dados insuficientes" (se null/ausente) ou "desvio" (se false), nunca assumir que passou.

4. CRITÉRIOS DE ENTRADA
- Campo: contexto, gatilho, combustivel.
- Sem região válida (seção 3), não existe operação — independe de resultado.
- contexto = "abertura" + combustivel favorável + mercado já na direção esperada: entrada imediata na virada do candle é aceitável, sem exigir confirmação extra.
- contexto = "fora_abertura" + maior volatilidade: regiao_entrada válida + gatilho no 1min (ex: martelo, barra de força) já é suficiente.
- contexto = "fora_abertura" + menor volatilidade: exigir confirmação em 2min/5min, segunda falha no mesmo fundo, ou horário de maior volatilidade — se gatilho não refletir isso, é desvio.

5. GESTÃO DE RISCO
- Campo: stop_pontos, contratos, mao, contexto.
- Stop sempre curto, baseado no fundo/topo da estrutura (fora da abertura). Na abertura, mão reduzida compensa a dificuldade de medir stop.
- Regra de contratos: stop_pontos alto → contratos deve ser menor; stop_pontos baixo → contratos pode ser maior. Avaliar se contratos é coerente com stop_pontos.
- mao deve ser coerente com o contexto: "abertura" → mao "baixa"; dia normal → "padrao"; dia com movimento excelente / após gain / semana boa → "maxima" é aceitável, mas mao "maxima" sem esse contexto é desvio.

6. QUANTIDADE DE OPERAÇÕES
- Campo: contagem total de trades no dia/período.
- Ideal 1–2 no dia, evitar passar de 3. Máximo excepcional: 5. Sem mínimo obrigatório. Mais que 5 é desvio quase sempre.

7. SAÍDAS
- Campo: parcial_1_1.
- Parcial em 1:1 é quase obrigatória ao chegar em região de trava com mercado já andado. parcial_1_1 = false sem justificativa nas observações é desvio potencial (reportar como ponto de atenção).

8. MOVIMENTAÇÃO DO STOP
- Campo: stop_movido.
- Só mover o stop quando o gráfico confirma nova estrutura (novo fundo/topo). Se stop_movido indicar "sim" sem menção a nova estrutura confirmada, é desvio.

9. STOP E SAÍDA NO PREJUÍZO
- Campo: saida_manual_antecipada.
- Não encerrar manualmente uma operação perdedora antes do stop. saida_manual_antecipada = true é desvio, a menos que as observações descrevam uma situação excepcional clara.

10. NOTÍCIAS
- Campo: combustivel.noticia_9h, horario_entrada.
- Notícias de 3 estrelas: evitar iniciar operação nesse exato momento. Se já posicionado antes, não precisa sair.

11. CONDIÇÃO EMOCIONAL
- Campo: observations (texto livre do trader).
- Se as observações mencionarem abalo emocional/pessoal, sinalizar isso como fator de risco, independente do resultado do trade.

12. DISCIPLINA E ENCERRAMENTO DO DIA
- Campo: sequência de resultado dos trades do dia.
- 2 losses consecutivos → parar (exceto se ambos pequenos, permite uma 3ª tentativa). 3 losses consecutivos → encerra o dia. Verificar se isso foi respeitado na sequência de trades fornecida.

13. RESUMO DE DESVIOS (usar esta lista para classificar cada achado)
- Entrar fora de região válida (seção 3).
- Pullback sem as 3 condições simultâneas (seção 3).
- horario_entrada > 11:00 (seção 1).
- Entrar sem o gatilho/confirmação adequado ao contexto (seção 4).
- mao incompatível com contexto/stop (seção 5).
- Mais operações que o padrão (seção 6).
- saida_manual_antecipada sem justificativa (seção 9).
- Ignorar regra de notícias de 3 estrelas (seção 10).
- Operar com observations indicando abalo emocional (seção 11).

PRINCÍPIO FUNDAMENTAL: o operacional não muda porque houve gain ou loss. Avalie SEMPRE o processo, nunca o resultado financeiro. Se um campo necessário para avaliar uma regra estiver ausente ou null, declare explicitamente "dados insuficientes para avaliar [regra]" em vez de supor.
`;

  // Exemplos few-shot curtos para calibrar o tom e o nível de especificidade
  // esperado (um bem executado, um com desvio claro).
  const EXEMPLOS = `
EXEMPLO 1 (execução correta — para calibrar o tom):
Trade: ativo=WINM25, horario_entrada=09:03, contexto=abertura, regiao_entrada="suporte diário", pullback=null, gatilho="virada de candle", combustivel={noticia_9h:"sim, favorável", trio:"favorável"}, mao=baixa, resultado=loss.
Julgamento correto: "Trade em WINM25 às 09:03 (abertura) foi executado dentro do operacional: entrada na virada do candle com combustível favorável (notícia + trio), mão baixa compatível com o contexto de abertura. O resultado foi loss, mas o processo foi respeitado — não é desvio."

EXEMPLO 2 (desvio — para calibrar o tom):
Trade: ativo=WINM25, horario_entrada=11:20, regiao_entrada="nenhuma mencionada", pullback=null, gatilho="nenhum mencionado", mao=maxima, resultado=gain.
Julgamento correto: "Trade em WINM25 às 11:20 é um desvio: horario_entrada está fora da janela operacional (09:00–11:00), independente de o resultado ter sido gain. Também não há regiao_entrada informada, o que por si só já invalidaria a entrada."
`;

  const prompt = `Você é um analista de trading experiente contratado para auditar a EXECUÇÃO de um trader — não o resultado financeiro dele.

Abaixo está o operacional do trader (checklist nomeado, cada regra aponta o campo de dado a consultar), exemplos calibrando o tom esperado, e por fim os trades e observações reais a analisar.

OPERACIONAL DO TRADER:
${MEU_OPERACIONAL}

${EXEMPLOS}

TRADES (JSON — consulte os campos nomeados no operacional acima):
${JSON.stringify(trades ?? [], null, 2)}

OBSERVAÇÕES DO TRADER:
${observations}

INSTRUÇÕES:
- Para cada afirmação (positiva ou desvio), cite o campo e o valor exato do trade que sustenta o julgamento (ex: "horario_entrada=11:20" ou "pullback.tocou_mme9_5min=false"). Não faça afirmações sem base em um campo específico ou nas observações.
- Julgue estritamente pela aderência ao operacional, nunca pelo campo resultado (gain/loss).
- Se um campo necessário para avaliar uma regra estiver ausente, null ou não mencionado nas observações, declare explicitamente "dados insuficientes para avaliar [regra]" — não presuma que passou.
- Para pullback especificamente: só considere região válida se as 3 subcondições estiverem true. Caso contrário, trate como "dados insuficientes" (se ausente) ou "desvio" (se false).
- Separe claramente o que foi bem executado do que foi desvio do plano.
- Seja específico: cite o trade (data/ativo/horário) em cada ponto, nunca generalize para "o dia todo".

Responda APENAS com um JSON válido (sem markdown, sem texto fora do JSON) no seguinte formato:
{
  "resumo": "um parágrafo objetivo sobre o dia/período: contexto de mercado, padrão dos trades, e conclusão geral sobre aderência ao operacional",
  "pontos_positivos": ["execução que respeitou o operacional, citando trade e campo", "..."],
  "desvios": ["desvio específico, citando trade e campo/valor exato", "..."],
  "dados_insuficientes": ["regra que não pôde ser avaliada por falta de dado, e qual campo faltou", "..."],
  "melhorias": ["sugestão prática e específica 1", "sugestão 2", "sugestão 3"]
}`;

  const model = 'gemini-3.1-flash-lite'; // modelo estável com cota gratuita generosa (~1000 req/dia)
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;
  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.2, // reduzido: menos "criatividade", mais aderência literal ao checklist
      maxOutputTokens: 2000, // aumentado por causa do novo campo "dados_insuficientes" + citações mais longas
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
      parsed = {
        resumo: rawText,
        pontos_positivos: [],
        desvios: [],
        dados_insuficientes: [],
        melhorias: [],
      };
    }

    return res.status(200).json(parsed);
  } catch (err) {
    console.error('Erro ao gerar resumo:', err);
    return res.status(500).json({ error: 'Erro interno ao gerar o resumo' });
  }
}
