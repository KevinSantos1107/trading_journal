// api/summarize.js
// Serverless function da Vercel — roda no servidor, nunca no navegador.
// Recebe os trades e observações do usuário e devolve um resumo + sugestões de melhoria
// gerados pela API do Gemini.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { trades, observations } = req.body;

  if (!observations || observations.trim().length === 0) {
    return res.status(400).json({ error: 'Nenhuma observação fornecida' });
  }

  const prompt = `Você é um analista de trading experiente. Abaixo estão os trades e as observações de um trader de day trade sobre o dia/período.

TRADES:
${JSON.stringify(trades ?? [], null, 2)}

OBSERVAÇÕES DO TRADER:
${observations}

Responda APENAS com um JSON válido (sem markdown, sem texto fora do JSON) no seguinte formato:
{
  "resumo": "um resumo objetivo do que aconteceu no dia/período, incluindo contexto de mercado e padrão dos trades",
  "melhorias": ["ponto de melhoria 1", "ponto de melhoria 2", "ponto de melhoria 3"]
}`;

  const model = 'gemini-3.1-flash-lite';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;

  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 800,
    },
  });

  // Tenta até 3 vezes se o modelo estiver sobrecarregado (erro 503/429)
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
      const sobrecarregado = response.status === 503 || response.status === 429;

      if (!sobrecarregado || tentativa === MAX_TENTATIVAS) {
        console.error('Erro da API Gemini:', errText);
        return res.status(502).json({ error: 'Falha ao consultar a IA', detalhe: errText });
      }

      // espera antes de tentar de novo (500ms, depois 1s)
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
      parsed = { resumo: rawText, melhorias: [] };
    }

    return res.status(200).json(parsed);
  } catch (err) {
    console.error('Erro ao gerar resumo:', err);
    return res.status(500).json({ error: 'Erro interno ao gerar o resumo' });
  }
}
