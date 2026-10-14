// api/summarize-plugin.js
// Handler compartilhado para análise de trades com Gemini AI.

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
- Pullback válido: macro + micro alinhados + toque mínimo na MME9 com médias alinhadas. Faltando qualquer item = inválido.

5. GESTÃO DE RISCO
- Stop curto, nas extremidades da estrutura. Mais pontos de stop = menos contratos, e vice-versa.
- Mão: baixa (abertura), padrão (dia normal), máxima (dia muito bom / após gain / semana boa).

6. QUANTIDADE
- Ideal 1-2 no dia, evitar passar de 3. Máximo excepcional: 5.
- OVERTRADING: mais de 5 operações no mesmo dia = desvio grave, independente do resultado.

7. SAÍDAS
- Parcial em 1:1 quase obrigatória em região de trava com mercado andado. Resto sai em trava/médias/topos/resistências.

8. STOP
- Só move com nova estrutura confirmada. Nunca só por estar positivo.
- Não encerra loss manualmente antes do stop, salvo exceção rara.

9. NOTÍCIAS
- 3 estrelas: evitar iniciar operação no momento. Se já posicionado, pode manter.

10. EMOCIONAL
- Emoções negativas (ansioso, irritado, impulsivo, vingativo, com medo) = evitar operar.

11. DISCIPLINA
- 2 losses seguidos = parar. 3 losses seguidos = encerra o dia.
- Encerra também ao bater meta ou após movimento muito grande.

12. FILTROS DE QUALIDADE TÉCNICA
- Região de médias, fibo, suporte/resistência. Mais confluência = entrada mais embasada.

PRINCÍPIO: o operacional não muda por gain ou loss. Avalie o processo, nunca o resultado.
`;

import fs from 'node:fs';
import path from 'node:path';

function getApiKey() {
  try {
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      const match = content.match(/GEMINI_API_KEY=(.*)/);
      if (match && match[1]?.trim()) {
        return match[1].trim();
      }
    }
  } catch {}
  return process.env.GEMINI_API_KEY || '';
}

export async function summarizeHandler(req, res) {
  const { trades, observations, activeAccount, periodLabel } = req.body;

  if (!trades || trades.length === 0) {
    return res.status(400).json({ error: 'Nenhuma operação encontrada para o período selecionado.' });
  }

  if (!observations || observations.trim().length === 0) {
    return res.status(400).json({ error: 'Nenhuma anotação/observação encontrada nas operações deste período.' });
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    console.error('[Gemini] GEMINI_API_KEY não configurada no ambiente.');
    return res.status(500).json({
      error: 'Chave GEMINI_API_KEY não encontrada. Adicione sua chave no arquivo .env.local.',
    });
  }

  const accountContext = activeAccount ? `\nCONTA ANALISADA: ${activeAccount}\n` : '';
  const periodContext = periodLabel ? `\nPERÍODO ANALISADO: ${periodLabel}\n` : '';

  // Sanitiza e formata os trades para remover IDs internos e apresentar dados legíveis
  const sanitizedTrades = trades.map((t) => {
    // Formata a data: de "2026-09-01" para "01/09"
    const dataFormatada = t.date ? t.date.split('-').reverse().slice(0, 2).join('/') : t.date;
    const horario = t.details?.entryTime ? ` às ${t.details.entryTime}` : '';

    return {
      identificacao: `${t.asset} em ${dataFormatada}${horario} (${t.strategy})`,
      data: dataFormatada,
      horario: t.details?.entryTime || 'Não informado',
      ativo: t.asset,
      estrategia: t.strategy,
      direcao: t.details?.direction || 'Não informada',
      contratos: t.contracts,
      pontos: t.points,
      resultado: t.result > 0 ? `+R$ ${t.result}` : `R$ ${t.result}`,
      observacoesTrade: t.note || '',
      emocional: t.details?.emotion || 'Normal',
      filtrosQualidade: t.details?.qualityFilters || {},
      regrasObrigatorias: t.details?.mandatoryRules || {},
    };
  });

  const prompt = `Você é um analista de trading auditando a EXECUÇÃO de um trader — não o resultado financeiro.
${accountContext}${periodContext}
OPERACIONAL DO TRADER:
${MEU_OPERACIONAL}

OPERAÇÕES DO PERÍODO (${sanitizedTrades.length} operações):
${JSON.stringify(sanitizedTrades, null, 2)}

OBSERVAÇÕES E NOTAS DO TRADER:
${observations}

INSTRUÇÕES RIGOROSAS:
- FORMA DE CITAR AS OPERAÇÕES: NUNCA use códigos ou números de identificação internos. Ao citar uma operação, use SEMPRE a identificação amigável: nome do ativo, data (DD/MM) e estratégia (ex: "no Mini Índice em 01/09 (Abertura sem Notícia)").
- ESCOPO TEMPORAL RESTRITO: Limite-se ESTRITAMENTE às operações listadas acima no período "${periodLabel || 'selecionado'}". NUNCA mencione nem deduza nada sobre datas ou operações fora desta lista.
- Julgue cada trade estritamente pela aderência ao operacional. Nunca pelo resultado financeiro (gain/loss).
- Não invente informações. Se faltar dado para avaliar alguma regra, diga "dados insuficientes".
- Seja direto: uma frase por item.
- Não repita a mesma constatação em pontos_positivos e desvios.

Responda APENAS com JSON válido (sem markdown, sem texto fora do JSON):
{
  "resumo": "2-3 frases sobre aderência geral ao operacional especificamente no período (${periodLabel || 'selecionado'})",
  "pontos_positivos": ["frase curta citando a operação amigavelmente"],
  "desvios": ["frase curta citando a operação amigavelmente"],
  "melhorias": ["sugestão curta e prática voltada para este período"]
}`;

  // Modelo solicitado pelo usuário
  const GEMINI_MODEL = 'gemini-3.5-flash-lite';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const requestBody = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 2048,
      responseMimeType: 'application/json',
    },
  });

  const MAX_TENTATIVAS = 3;
  let response, errText;

  try {
    for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: requestBody,
      });

      if (response.ok) break;

      errText = await response.text();
      console.error(`[Gemini] Erro (tentativa ${tentativa}/${MAX_TENTATIVAS}): HTTP ${response.status}`, errText);

      // Erro 400: chave inválida ou problema no formato
      if (response.status === 400) {
        if (errText.includes('API_KEY_INVALID') || errText.includes('API key not valid')) {
          return res.status(400).json({
            error: 'A chave GEMINI_API_KEY no arquivo .env.local é inválida ou expirou. Gere uma nova chave em https://aistudio.google.com/app/apikey.',
            detail: errText,
          });
        }
        return res.status(400).json({
          error: 'Requisição rejeitada pela API do Google.',
          detail: errText,
        });
      }

      // Erro 429: limite de requisições / cota
      if (response.status === 429) {
        const retryAfterSec = parseInt(response.headers?.get?.('Retry-After') ?? '0', 10);
        if (retryAfterSec > 0 && retryAfterSec <= 20 && tentativa < MAX_TENTATIVAS) {
          console.warn(`[Gemini] Aguardando ${retryAfterSec}s devido a 429...`);
          await new Promise((r) => setTimeout(r, retryAfterSec * 1000));
          continue;
        }
        return res.status(429).json({
          error: 'Limite de uso da IA atingido temporariamente. Aguarde 1 a 2 minutos e tente novamente.',
          detail: errText,
        });
      }

      // Erro 404: modelo indisponível
      if (response.status === 404) {
        return res.status(502).json({
          error: `O modelo "${GEMINI_MODEL}" não foi encontrado na API do Gemini.`,
          detail: errText,
        });
      }

      // Erro 503 / 500: sobrecarga temporária do servidor Google
      if ([500, 502, 503, 504].includes(response.status) && tentativa < MAX_TENTATIVAS) {
        const espera = tentativa * 1000;
        console.warn(`[Gemini] Servidor instável (${response.status}). Tentando novamente em ${espera}ms...`);
        await new Promise((r) => setTimeout(r, espera));
        continue;
      }

      // Outro erro sem retry
      return res.status(502).json({
        error: `Falha na comunicação com a IA (HTTP ${response.status}).`,
        detail: errText,
      });
    }

    if (!response || !response.ok) {
      return res.status(502).json({
        error: 'Não foi possível obter resposta da IA após múltiplas tentativas.',
        detail: errText,
      });
    }

    const data = await response.json();
    const candidate = data?.candidates?.[0];
    const rawParts = candidate?.content?.parts ?? [];
    // Filtra eventuais partes de raciocínio se o modelo emitir 'thought'
    const rawText = rawParts
      .filter((p) => !p.thought && typeof p.text === 'string')
      .map((p) => p.text)
      .join('') || (rawParts[0]?.text ?? '');

    const finishReason = candidate?.finishReason;
    const cleaned = rawText.replace(/```json|```/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      console.error('[Gemini] JSON não pôde ser parseado diretamente. Conteúdo bruto:', rawText);
      const motivo =
        finishReason === 'MAX_TOKENS'
          ? 'A resposta foi cortada por exceder o limite de tokens.'
          : 'A IA retornou um formato inesperado.';
      return res.status(502).json({
        error: `Não foi possível interpretar a resposta da IA. ${motivo}`,
        raw: rawText,
      });
    }

    return res.status(200).json(parsed);
  } catch (err) {
    console.error('[Gemini] Erro interno:', err);
    return res.status(500).json({
      error: 'Erro interno ao processar a análise com a IA.',
      detail: err?.message || String(err),
    });
  }
}
