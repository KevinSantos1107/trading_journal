// api/summarize.js
// Serverless function da Vercel — roda no servidor.
import { summarizeHandler } from './summarize-plugin.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }
  return summarizeHandler(req, res);
}
