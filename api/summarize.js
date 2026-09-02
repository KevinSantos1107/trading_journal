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
  // OPERACIONAL — a forma correta de operar, definida pelo trader.
  // Isso é usado como régua fixa: a IA compara cada trade com estas regras,
  // independente do resultado financeiro ter sido gain ou loss.
  // ==========================================================================
  const MEU_OPERACIONAL = `
1. ATIVOS E HORÁRIOS
- Ativo principal: WIN (mini-índice). Pode ser aplicado a qualquer ativo.
- Janela operacional: das 9h às 11h. Após 11h, não há operações.
- A abertura é parte central do operacional; é permitido operar no primeiro minuto.

2. LEITURA DE MERCADO E CONTEXTO
- Leitura de cima para baixo: Semanal → Diário → 60min → 15min → 5min → 2min → 1min.
- 5min e 2min: base de leitura/confirmação. 1min: execução.
- Combustível da abertura = Notícia (se houver às 9h) + Trio (VIX, petróleo, minério de ferro).
- Com combustível, a leitura direcional é mais clara. Sem combustível e Trio neutro, a abertura é mais complicada — mas não proibida, se o preço abrir em região válida.

3. REGIÕES VÁLIDAS
- Suporte, resistência, troca de polaridade, 50%, 61%, 76,2%, MME9, MMA20, MMA50, MMA200, MME200.
- Não há classificação fixa A/B/C — quanto maior a confluência, melhor. Preferência por extremos.
- Pullback: só é válido operar como região quando TODOS os critérios abaixo forem atendidos simultaneamente:
  a) Pullback alinhado com a tendência vigente (não contra-tendência).
  b) O mínimo/máximo do pullback toca, no mínimo, a MME9 do gráfico de 5min (pode ir além, até MMA20/MMA50, mas nunca menos que a MME9).
  c) As médias móveis MME9, MMA20 e MMA50 do 5min estão alinhadas entre si na direção da tendência (ex: em alta, MME9 > MMA20 > MMA50).
- Sem esses três critérios simultaneamente, o pullback NÃO é considerado região válida — mesmo que pareça "claro" visualmente.

4. CRITÉRIOS DE ENTRADA
- Regra central: sem região válida, não existe operação. Isso não muda após gain ou loss.
- Abertura: entrada pode ocorrer na virada do candle; com combustível e mercado já na direção esperada, pode haver entrada imediata sem esperar confirmações.
- Fora da abertura, com maior volatilidade: região válida + gatilho no 1min (ex: martelo, barra de força) já pode ser suficiente.
- Fora da abertura, com menor volatilidade: esperar formação do 2min (às vezes 5min), ou segunda falha no mesmo fundo, ou horário de maior volatilidade.

5. GESTÃO DE RISCO
- Stop sempre curto (opera extremidades). Fora da abertura: baseado no fundo/topo da estrutura da operação.
- Na abertura: mão reduzida, risco controlado via exposição (execução rápida demais para medir stop do mesmo jeito).
- Lógica de contratos: mais pontos de stop → menos contratos; menos pontos de stop → mais contratos.
- Três níveis de mão: baixa, padrão, máxima. Abertura → mão baixa. Dia normal → mão padrão. Dia com movimento muito bom, ou após gain, ou semana boa → mão máxima pode ser usada.

6. QUANTIDADE DE OPERAÇÕES
- Objetivo: mínimo possível. Ideal 1-2 no dia, idealmente não passar de 3. Máximo excepcional: 5. Sem obrigação de mínimo.

7. SAÍDAS
- Parcial em 1:1 — quase obrigatória ao chegar em região de trava com o mercado já andado.
- Restante da posição fica aberto, stop conforme estrutura, saída em pontos de trava, médias, topos, resistências, espaço gráfico.

8. MOVIMENTAÇÃO DO STOP
- Stop não é movido só porque a operação ficou positiva. Só se move quando o gráfico confirma nova estrutura (novo fundo/topo na direção da operação). Sem regra automática de breakeven por lucro atingido.

9. STOP E SAÍDA NO PREJUÍZO
- Regra geral: não encerrar manualmente uma operação perdedora antes do stop. Saídas antecipadas são exceção rara, não regra.

10. NOTÍCIAS
- Notícias de 3 estrelas: evitar iniciar operação nesse momento. Se já posicionado antes, não é exigido sair — há inclusive preferência por atravessar a notícia com a operação já estabelecida.

11. CONDIÇÃO EMOCIONAL
- Se o emocional estiver abalado por motivos pessoais, é recomendável evitar operar.

12. DISCIPLINA E ENCERRAMENTO DO DIA
- 2 losses consecutivos: regra geral é parar (exceto se ambos forem pequenos, permitindo uma terceira). 3 losses consecutivos: encerra o dia.
- Encerramento também ao atingir a meta pessoal ou após movimento muito grande do mercado.

13. O QUE CARACTERIZA UM DESVIO DO PLANO
- Entrar fora de região válida.
- Entrar em pullback sem os três critérios (alinhamento com tendência, mínimo na MME9 do 5min, e MME9/MMA20/MMA50 alinhadas).
- Operar depois das 11h.
- Entrar sem o gatilho/critério adequado ao contexto quando confirmação era necessária.
- Usar mão incompatível com o contexto e o tamanho do stop.
- Operações excessivas em relação ao padrão estabelecido.
- Encerrar operação perdedora antes do stop sem situação excepcional válida.
- Operar emocionalmente abalado por motivos pessoais.
- Ignorar regras de notícias de 3 estrelas.

PRINCÍPIO FUNDAMENTAL: o operacional não muda porque houve gain ou loss. A análise deve avaliar se o PROCESSO foi respeitado, nunca se o resultado financeiro foi positivo ou negativo.
`;

  const prompt = `Você é um analista de trading experiente contratado para auditar a EXECUÇÃO de um trader — não o resultado financeiro dele.

Abaixo está o operacional que o trader define como sua forma correta de operar, seguido dos trades e observações do dia/período.

OPERACIONAL DO TRADER:
${MEU_OPERACIONAL}

TRADES:
${JSON.stringify(trades ?? [], null, 2)}

OBSERVAÇÕES DO TRADER:
${observations}

INSTRUÇÕES:
- Julgue cada trade e o dia como um todo estritamente pelo grau de aderência ao operacional acima — nunca pelo resultado (gain/loss) da operação.
- Se a informação disponível nos trades/observações não for suficiente para avaliar algum critério (ex: não há dados sobre região de entrada), NÃO invente um julgamento — diga explicitamente que não há dados suficientes para esse ponto.
- Ao avaliar pullback especificamente, verifique se as observações mencionam os três critérios (alinhamento com tendência, toque mínimo na MME9 do 5min, médias alinhadas). Se não houver dados suficientes sobre isso, diga explicitamente.
- Separe claramente o que foi bem executado do que foi um desvio do plano.
- Seja específico: cite o trade (data/ativo) quando apontar algo, em vez de generalizar.

Responda APENAS com um JSON válido (sem markdown, sem texto fora do JSON) no seguinte formato:
{
  "resumo": "um parágrafo objetivo sobre o dia/período: contexto de mercado, padrão dos trades, e conclusão geral sobre aderência ao operacional",
  "pontos_positivos": ["execução que respeitou o operacional 1", "execução 2"],
  "desvios": ["desvio específico do operacional 1, citando o trade", "desvio 2"],
  "melhorias": ["sugestão prática e específica 1", "sugestão 2", "sugestão 3"]
}`;

  const model = 'gemini-3.1-flash-lite'; // modelo estável com cota gratuita generosa (~1000 req/dia)
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;
  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 1200, // aumentado por causa do campo "desvios" extra
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