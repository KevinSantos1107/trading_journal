import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { summarizeHandler } from './api/summarize-plugin.js';

// Plugin que serve a rota /api/summarize diretamente no dev server do Vite
// sem precisar do `vercel dev` rodando em paralelo.
function apiPlugin() {
  return {
    name: 'api-plugin',
    configureServer(server) {
      server.middlewares.use('/api/summarize', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Método não permitido' }));
          return;
        }

        let body = '';
        req.on('data', (chunk) => { body += chunk.toString(); });
        req.on('end', async () => {
          try {
            req.body = JSON.parse(body);
          } catch {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Body inválido' }));
            return;
          }

          // Adapter para compatibilidade com a interface do handler Vercel
          const mockRes = {
            _status: 200,
            status(code) { this._status = code; return this; },
            json(data) {
              res.statusCode = this._status;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(data));
            },
          };

          await summarizeHandler(req, mockRes);
        });
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Carrega TODAS as variáveis de .env.local (prefixo '' = sem filtro)
  const env = loadEnv(mode, process.cwd(), '');

  // Injeta no process.env para o middleware ter acesso em runtime
  process.env.GEMINI_API_KEY = env.GEMINI_API_KEY ?? process.env.GEMINI_API_KEY ?? '';

  if (!process.env.GEMINI_API_KEY) {
    console.warn('[API Plugin] AVISO: GEMINI_API_KEY não encontrada no .env.local');
  } else {
    console.log('[API Plugin] GEMINI_API_KEY carregada com sucesso.');
  }

  return {
    plugins: [react(), apiPlugin()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    optimizeDeps: {
      exclude: ['lucide-react'],
    },
  };
});
