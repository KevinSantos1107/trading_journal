import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { X, Upload, Download, Check, AlertCircle, FileSpreadsheet } from 'lucide-react';
import type { Trade, OperationalConfig, AssetConfig } from '@/lib/types';
import { matchAsset } from '@/lib/calc';

type Props = {
  onClose: () => void;
  onImport: (trades: Trade[]) => void;
  defaultAccount: string;
  operationalConfig?: OperationalConfig | null;
};

// ── Normalização de string de cabeçalho ───────────────────────────────────
// Remove acentos, espaços extras, pontuação e lowercases
function normalizeKey(s: string): string {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // remove acentos
    .replace(/[^a-z0-9 ]/g, ' ')       // remove pontuação
    .replace(/\s+/g, ' ')              // colapsa espaços
    .trim();
}

// ── Mapa de colunas: normalizado → campo interno ──────────────────────────
// Inclui colunas específicas da Nelogica/Profit, Ylos e formato genérico
const COL_MAP: Record<string, string> = {
  // ─ Data e Horários ─
  'data': 'date', 'data hora': 'date', 'date': 'date', 'datetime': 'date',
  'abertura': 'date', 'data abertura': 'date', 'data hora abertura': 'date',
  'fechamento': 'exit_time', 'data fechamento': 'exit_time', 'data hora fechamento': 'exit_time',
  'hora fechamento': 'exit_time', 'horario fechamento': 'exit_time',
  'hora saida': 'exit_time', 'horario saida': 'exit_time', 'horario de saida': 'exit_time', 'saida': 'exit_time',
  'close time': 'exit_time', 'exit time': 'exit_time',
  'hora abertura': 'entry_time', 'horario abertura': 'entry_time',
  'hora entrada': 'entry_time', 'horario entrada': 'entry_time', 'horario de entrada': 'entry_time', 'entrada': 'entry_time',
  'open time': 'entry_time', 'entry time': 'entry_time',
  'hora': 'entry_time', 'horario': 'entry_time', 'time': 'entry_time',
  'tempo op': 'duration', 'tempo operacao': 'duration', 'tempo de operacao': 'duration', 'duracao': 'duration', 'duration': 'duration',

  // ─ Ativo ─
  'ativo': 'asset', 'papel': 'asset', 'instrumento': 'asset', 'ticker': 'asset',
  'simbolo': 'asset', 'asset': 'asset', 'codigo': 'asset', 'symbol': 'asset', 'instrument': 'asset',

  // ─ Contratos / Quantidade (Nelogica, Profit, Ylos, MT5, etc.) ─
  'qtd': 'contracts', 'qtd.': 'contracts', 'qtde': 'contracts', 'qtde.': 'contracts',
  'quantidade': 'contracts', 'quantidade total': 'contracts', 'qtd total': 'contracts', 'qtde total': 'contracts',
  'qtd operada': 'contracts', 'qtde operada': 'contracts', 'quantidade operada': 'contracts',
  'qtd executada': 'contracts', 'qtde executada': 'contracts', 'quantidade executada': 'contracts',
  'qtd aberta': 'contracts', 'qtde aberta': 'contracts', 'quantidade aberta': 'contracts',
  'qtd contratos': 'contracts', 'quantidade contratos': 'contracts', 'numero de contratos': 'contracts',
  'n contratos': 'contracts', 'num contratos': 'contracts', 'nr contratos': 'contracts',
  'contratos': 'contracts', 'contrato': 'contracts', 'contracts': 'contracts', 'contract': 'contracts',
  'volume contratos': 'contracts', 'volume': 'contracts', 'vol': 'contracts',
  'posicao': 'contracts', 'posicao final': 'contracts', 'lote': 'contracts', 'lotes': 'contracts',
  'tamanho': 'contracts', 'tamanho posicao': 'contracts', 'tamanho da posicao': 'contracts',
  'size': 'contracts', 'position size': 'contracts', 'position': 'contracts',
  'qty': 'contracts', 'quantity': 'contracts', 'total qty': 'contracts', 'total quantity': 'contracts',
  'filled qty': 'contracts', 'executed qty': 'contracts', 'exec qty': 'contracts', 'order qty': 'contracts',
  'lots': 'contracts', 'lot': 'contracts', 'shares': 'contracts',

  // Compra / Venda separadas (Nelogica usa "Qtd Comp" e "Qtd Vend")
  'qtd comp': 'qty_buy', 'qtde comp': 'qty_buy', 'quantidade compra': 'qty_buy',
  'qtd compra': 'qty_buy', 'qtde compra': 'qty_buy', 'qtd c': 'qty_buy',
  'qtd vend': 'qty_sell', 'qtde vend': 'qty_sell', 'quantidade venda': 'qty_sell',
  'qtd venda': 'qty_sell', 'qtde venda': 'qty_sell', 'qtd v': 'qty_sell',
  'buy qty': 'qty_buy', 'sell qty': 'qty_sell',

  // ─ Resultado ─ (Nelogica usa "Res. Operação")
  'res operacao': 'result', 'resultado operacao': 'result', 'resultado financeiro': 'result',
  'resultado': 'result', 'result': 'result', 'lucro prejuizo': 'result',
  'lucro': 'result', 'p l': 'result', 'pnl': 'result', 'profit': 'result', 'net profit': 'result',
  'res liquido': 'result', 'resultado liquido': 'result', 'net pnl': 'result', 'gain': 'result',
  'bruto': 'result_bruto',

  // ─ Pontos ─
  'pontos': 'points', 'pts': 'points', 'ptos': 'points', 'points': 'points',
  'pontuacao': 'points', 'ticks': 'points', 'pips': 'points',

  // ─ Preços de Entrada / Saída ─
  'preco compra': 'buy_price', 'preco venda': 'sell_price', 'preco entrada': 'entry_price',
  'preco saida': 'exit_price', 'preco medio': 'entry_price', 'preco': 'entry_price',
  'entry price': 'entry_price', 'exit price': 'exit_price', 'buy price': 'buy_price', 'sell price': 'sell_price',

  // ─ Estratégia ─
  'estrategia': 'strategy', 'setup': 'strategy', 'strategy': 'strategy',

  // ─ Conta ─
  'conta': 'account', 'account': 'account',

  // ─ Direção / Lado ─ (Nelogica usa "Lado" com valores "C" / "V")
  'lado': 'direction', 'direcao': 'direction', 'tipo': 'direction',
  'operacao': 'direction', 'direction': 'direction', 'side': 'direction',
};

// ── Parser de horários ────────────────────────────────────────────────────
function parseTime(raw: string | number | undefined): string | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined;
  if (typeof raw === 'number') {
    if (raw > 0) {
      try {
        const d = XLSX.SSF.parse_date_code(raw);
        if (d && (d.H > 0 || d.M > 0 || d.S > 0)) {
          const h = String(d.H).padStart(2, '0');
          const m = String(d.M).padStart(2, '0');
          const s = String(d.S).padStart(2, '0');
          return `${h}:${m}:${s}`;
        }
      } catch { /* ignore */ }
    }
    return undefined;
  }
  const s = String(raw).trim();
  const m = s.match(/(?:^|\s)(\d{1,2}):(\d{2})(?::(\d{2})|\s+(\d{1,2})s)?/i);
  if (m) {
    const hh = m[1].padStart(2, '0');
    const mm = m[2].padStart(2, '0');
    const ss = m[3] ? m[3].padStart(2, '0') : m[4] ? m[4].padStart(2, '0') : '00';
    return `${hh}:${mm}:${ss}`;
  }
  return undefined;
}

function addDuration(timeStr: string, durationStr: string): string | undefined {
  const tParts = timeStr.split(':').map(Number);
  if (tParts.length < 2) return undefined;
  let totalSec = (tParts[0] * 3600) + (tParts[1] * 60) + (tParts[2] || 0);

  const secMatch = durationStr.match(/(\d+)\s*s/i);
  const minMatch = durationStr.match(/(\d+)\s*m/i);
  const hourMatch = durationStr.match(/(\d+)\s*h/i);
  let durSec = 0;
  if (secMatch || minMatch || hourMatch) {
    if (secMatch) durSec += Number(secMatch[1]);
    if (minMatch) durSec += Number(minMatch[1]) * 60;
    if (hourMatch) durSec += Number(hourMatch[1]) * 3600;
  } else {
    const colonMatch = durationStr.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (colonMatch) {
      durSec = Number(colonMatch[1]) * 60 + Number(colonMatch[2]);
      if (colonMatch[3]) durSec = durSec * 60 + Number(colonMatch[3]);
    }
  }

  if (durSec <= 0) return undefined;
  totalSec = (totalSec + durSec) % (24 * 3600);
  const hh = String(Math.floor(totalSec / 3600)).padStart(2, '0');
  const mm = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
  const ss = String(totalSec % 60).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

// ── Parser de data ────────────────────────────────────────────────────────
function parseDate(raw: string | number): string | null {
  if (typeof raw === 'number') {
    // Serial do Excel
    if (raw > 40000 && raw < 60000) {
      try {
        const parsed = XLSX.SSF.parse_date_code(raw);
        const mm = String(parsed.m).padStart(2, '0');
        const dd = String(parsed.d).padStart(2, '0');
        return `${parsed.y}-${mm}-${dd}`;
      } catch { return null; }
    }
    return null;
  }
  const s = String(raw ?? '').trim();
  // DD/MM/YYYY HH:MM ou DD/MM/YYYY
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  // YYYY-MM-DD
  const iso = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  return null;
}

// ── Parser de número BR ("1.234,56") ou US ("1234.56") ───────────────────
function parseNum(raw: string | number | undefined): number {
  if (raw === undefined || raw === null || raw === '') return 0;
  if (typeof raw === 'number') return isNaN(raw) ? 0 : raw;
  let s = String(raw).trim().replace(/\s/g, '');
  if (s === '-' || s === '') return 0;
  const isNegative = s.includes('-') || (s.startsWith('(') && s.endsWith(')'));
  s = s.replace(/[^\d,.]/g, '');
  if (!s) return 0;
  let num = 0;
  if (s.includes(',') && s.includes('.')) {
    num = parseFloat(s.replace(/\./g, '').replace(',', '.'));
  } else if (s.includes(',')) {
    num = parseFloat(s.replace(',', '.'));
  } else {
    num = parseFloat(s) || 0;
  }
  return isNegative ? -Math.abs(num) : num;
}

// ── Parser de direção ─────────────────────────────────────────────────────
function parseDirection(raw: string): 'Compra' | 'Venda' | undefined {
  const v = String(raw ?? '').trim().toLowerCase();
  if (v === 'c' || v.startsWith('comp') || v === 'b' || v === 'buy') return 'Compra';
  if (v === 'v' || v.startsWith('vend') || v === 's' || v === 'sell') return 'Venda';
  return undefined;
}

// ── Encontra a linha de cabeçalho real ───────────────────────────────────
// Procura a primeira linha que contém indicadores confiáveis de cabeçalho de trading
function findHeaderRow(rows: unknown[][]): number {
  for (let i = 0; i < Math.min(15, rows.length); i++) {
    const line = rows[i].map(c => normalizeKey(String(c ?? '')));
    if (
      line.includes('ativo') || line.includes('papel') || line.includes('instrumento') ||
      line.includes('symbol') || line.includes('ticker') || line.includes('asset') ||
      line.includes('contrato') || line.includes('contratos') || line.includes('contracts') ||
      line.includes('qtd') || line.includes('quantidade') || line.includes('data') ||
      line.includes('date') || line.includes('abertura')
    ) {
      return i;
    }
  }
  // Fallback: primeira linha com ≥ 4 células preenchidas
  for (let i = 0; i < Math.min(15, rows.length); i++) {
    if (rows[i].filter(c => String(c ?? '').trim()).length >= 4) return i;
  }
  return 0;
}

// ── Mapeia linhas de dados para trades ──────────────────────────────────
function mapRows(
  headers: string[],
  rows: unknown[][],
  defaultAccount: string,
  activeAssets: AssetConfig[],
): { trades: Trade[]; defaultUsed: boolean; detectedCols: string[] } {
  // Monta índice: campo interno → índice da coluna
  const idx: Record<string, number> = {};
  for (let i = 0; i < headers.length; i++) {
    const nk = normalizeKey(headers[i]);
    let field = COL_MAP[nk];
    if (!field) {
      if (nk.includes('contrat') || nk.includes('contract')) {
        field = 'contracts';
      } else if (nk.includes('comp') && (nk.includes('qtd') || nk.includes('quant') || nk.includes('qty'))) {
        field = 'qty_buy';
      } else if (nk.includes('vend') && (nk.includes('qtd') || nk.includes('quant') || nk.includes('qty'))) {
        field = 'qty_sell';
      } else if (nk.includes('buy') && nk.includes('qty')) {
        field = 'qty_buy';
      } else if (nk.includes('sell') && nk.includes('qty')) {
        field = 'qty_sell';
      } else if (
        nk.includes('qtd') ||
        nk.includes('quant') ||
        nk.includes('qty') ||
        nk.includes('size') ||
        nk.includes('lote') ||
        nk.includes('lot') ||
        nk.includes('posicao') ||
        nk.includes('position')
      ) {
        field = 'contracts';
      } else if (nk.includes('ativo') || nk.includes('papel') || nk.includes('ticker') || nk.includes('symbol')) {
        field = 'asset';
      } else if (nk.includes('lucro') || nk.includes('prejuizo') || nk.includes('pnl') || (nk.includes('res') && nk.includes('oper'))) {
        field = 'result';
      } else if (nk.includes('ponto') || nk.includes('tick') || nk.includes('pip')) {
        field = 'points';
      }
    }
    if (field) {
      if (field === 'date' && 'date' in idx && !('entry_time' in idx)) {
        field = 'entry_time';
      }
      if (!(field in idx)) idx[field] = i;
    }
  }

  const get = (row: unknown[], field: string): string =>
    idx[field] !== undefined ? String(row[idx[field]] ?? '').trim() : '';

  const getRaw = (row: unknown[], field: string): unknown =>
    idx[field] !== undefined ? row[idx[field]] : undefined;

  const detectedCols = headers.filter(h => h.trim());
  const trades: Trade[] = [];
  let defaultUsed = false;

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.every(c => !String(c ?? '').trim())) continue;

    // Data: tenta o campo "date", depois o raw (pode ser serial do Excel)
    const rawDate = getRaw(row, 'date');
    const date = parseDate(rawDate as string | number);
    if (!date) continue; // linha sem data → pula (ex: linha vazia, total...)

    // Horários de entrada e saída
    let entryTime = parseTime(getRaw(row, 'entry_time')) || parseTime(rawDate as string | number);
    let exitTime = parseTime(getRaw(row, 'exit_time'));
    const duration = get(row, 'duration');
    if (entryTime && duration && (!exitTime || exitTime === entryTime)) {
      const computedExit = addDuration(entryTime, duration);
      if (computedExit) exitTime = computedExit;
    }

    let rawAsset = get(row, 'asset') || 'Desconhecido';
    const matchedAsset = matchAsset(rawAsset, activeAssets);
    let asset = matchedAsset ? matchedAsset.name : rawAsset;
    let pointValue = matchedAsset ? matchedAsset.pointValue : 1;
    if (!matchedAsset) {
      const upAsset = rawAsset.toUpperCase();
      if (upAsset.startsWith('WIN')) { asset = 'Mini Índice'; pointValue = 0.2; }
      else if (upAsset.startsWith('WDO')) { asset = 'Mini Dólar'; pointValue = 10; }
      else if (upAsset.startsWith('IND')) { asset = 'Índice Cheio'; pointValue = 1; }
      else if (upAsset.startsWith('DOL')) { asset = 'Dólar Cheio'; pointValue = 50; }
    }

    const strategy = get(row, 'strategy') || 'Sem estratégia';

    // Contratos: tenta campo genérico 'contracts', senão pega qtd_buy ou qtd_sell
    let contracts = Math.abs(parseNum(getRaw(row, 'contracts')));
    if (!contracts) {
      const buy = Math.abs(parseNum(getRaw(row, 'qty_buy')));
      const sell = Math.abs(parseNum(getRaw(row, 'qty_sell')));
      contracts = Math.max(buy, sell) || buy || sell || 0;
    }
    // Se não encontrou nenhuma indicação de contratos, usa 1
    if (!contracts || contracts <= 0) {
      contracts = 1;
    }

    let points = parseNum(getRaw(row, 'points'));

    // Preços de entrada e saída (se disponíveis no arquivo)
    const rawBuyPrice = parseNum(getRaw(row, 'buy_price'));
    const rawSellPrice = parseNum(getRaw(row, 'sell_price'));
    const direction = parseDirection(get(row, 'direction'));

    let entryPrice = parseNum(getRaw(row, 'entry_price'));
    let exitPrice = parseNum(getRaw(row, 'exit_price'));

    if (!entryPrice && !exitPrice && (rawBuyPrice > 0 || rawSellPrice > 0)) {
      if (direction === 'Venda') {
        entryPrice = rawSellPrice;
        exitPrice = rawBuyPrice;
      } else {
        entryPrice = rawBuyPrice;
        exitPrice = rawSellPrice;
      }
    }

    if (points === 0 && entryPrice > 0 && exitPrice > 0) {
      if (direction === 'Venda') {
        points = Number((entryPrice - exitPrice).toFixed(2));
      } else {
        points = Number((exitPrice - entryPrice).toFixed(2));
      }
    }

    // Resultado: usa "result" se existir, senão "result_bruto"
    let result = parseNum(getRaw(row, 'result'));
    if (!result) result = parseNum(getRaw(row, 'result_bruto'));

    // Se tiver resultado financeiro e contratos reais, calcula os pontos por contrato com base no número real de contratos
    if (points === 0 && result !== 0 && contracts > 0) {
      points = Number((result / (contracts * pointValue)).toFixed(2));
    } else if (result === 0 && points !== 0 && contracts > 0) {
      result = Number((points * contracts * pointValue).toFixed(2));
    }

    // Garante que o sinal dos pontos seja consistente com o resultado financeiro:
    // Se a operação foi gain (result > 0), a pontuação deve ser positiva (+).
    // Se foi loss (result < 0), a pontuação deve ser negativa (-).
    if (result > 0 && points < 0) {
      points = Math.abs(points);
    } else if (result < 0 && points > 0) {
      points = -Math.abs(points);
    }

    // Saídas parciais (onde as informações de gain e pontos são preenchidas para cálculo)
    const partials = (points !== 0 || contracts > 0)
      ? [{ points, contracts }]
      : [];

    const account = get(row, 'account');
    if (!account) defaultUsed = true;

    trades.push({
      id: Date.now() + r,
      date,
      asset,
      strategy,
      contracts,
      points: 0,
      result,
      partials,
      details: {
        account: account || defaultAccount,
        direction,
        entryTime,
        exitTime,
      },
    });
  }

  return { trades, defaultUsed, detectedCols };
}

// ── Componente ────────────────────────────────────────────────────────────
export default function CsvImportModal({ onClose, onImport, defaultAccount, operationalConfig }: Props) {
  const DEFAULT_ASSETS: AssetConfig[] = [
    { name: 'Mini Índice', pointValue: 0.20 },
    { name: 'Mini Dólar', pointValue: 10.00 }
  ];
  const activeAssets = operationalConfig?.assets?.length ? operationalConfig.assets : DEFAULT_ASSETS;

  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [parsedTrades, setParsedTrades] = useState<Trade[]>([]);
  const [defaultUsed, setDefaultUsed] = useState(false);
  const [error, setError] = useState('');
  const [detectedCols, setDetectedCols] = useState<string[]>([]);

  const handleDownloadTemplate = () => {
    const rows = [
      ['Data', 'Ativo', 'Estrategia', 'Contratos', 'Pontos', 'Resultado', 'Conta', 'Direcao', 'Horario Entrada', 'Horario Saida'],
      ['24/09/2026', 'Mini Índice', 'Pullback', 2, 150, 30, 'Conta Pessoal', 'Compra', '10:15:00', '10:22:30'],
      ['23/09/2026', 'Mini Dólar', 'Rompimento', 1, -80, -80, 'Conta Pessoal', 'Venda', '14:30:00', '14:35:10'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Operações');
    XLSX.writeFile(wb, 'template_importacao_diario.xlsx');
  };

  const processFile = (buffer: ArrayBuffer) => {
    const data = new Uint8Array(buffer);
    const wb = XLSX.read(data, { type: 'array', raw: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    // raw: false para que datas seriais sejam mantidas como número
    const rawRows: unknown[][] = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      raw: true,
      defval: '',
    }) as unknown[][];

    if (rawRows.length < 2) {
      setError('O arquivo parece estar vazio.'); return;
    }

    const headerIdx = findHeaderRow(rawRows);
    const headers = (rawRows[headerIdx] as string[]).map(h => String(h ?? ''));
    const dataRows = rawRows.slice(headerIdx + 1) as unknown[][];

    const { trades, defaultUsed: du, detectedCols: cols } = mapRows(headers, dataRows, defaultAccount, activeAssets);

    setDetectedCols(cols);
    setDefaultUsed(du);

    if (trades.length === 0) {
      setError(
        `Nenhuma operação foi encontrada nas colunas detectadas: [${cols.slice(0, 6).join(', ')}${cols.length > 6 ? '...' : ''}]. ` +
        'Verifique se o arquivo tem uma coluna de data (Abertura, Data) e uma de resultado (Res. Operação, Resultado, Bruto).'
      );
      setParsedTrades([]);
    } else {
      setError('');
      setParsedTrades(trades);
    }
  };

  const handleFile = (file: File) => {
    setFileName(file.name);
    setError('');
    setParsedTrades([]);
    setDetectedCols([]);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        processFile(e.target?.result as ArrayBuffer);
      } catch (err) {
        console.error(err);
        setError('Não foi possível ler o arquivo. Verifique se não está corrompido.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  const totalResult = parsedTrades.reduce((s, t) => s + t.result, 0);
  const moneyBR = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="modal-backdrop">
      <div className="modal confirm-modal" style={{ maxWidth: '540px' }}>
        <div className="modal-header">
          <div>
            <span className="eyebrow">MIGRAÇÃO DE DADOS</span>
            <h2>Importar Operações</h2>
          </div>
          <button type="button" className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        <p style={{ color: '#a0a0a0', fontSize: '13px', lineHeight: '1.5', marginBottom: '16px' }}>
          Aceita <strong>.csv</strong>, <strong>.xlsx</strong> e <strong>.xls</strong> —
          incluindo exportações direto da <strong>Profit (Nelogica)</strong>.
          Detecta colunas automaticamente mesmo com linhas de metadados no início.
        </p>

        <button
          type="button"
          className="outline-button"
          onClick={handleDownloadTemplate}
          style={{ marginBottom: '14px', padding: '9px 14px', fontSize: '13px', display: 'flex', gap: '7px', alignItems: 'center' }}
        >
          <Download size={14} /> Baixar template (.xlsx)
        </button>

        {/* Drop zone */}
        <div
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
          onClick={() => inputRef.current?.click()}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '32px 16px', border: '1.5px dashed #3d1600', borderRadius: '12px',
            background: '#0a0807', cursor: 'pointer', marginBottom: '14px',
          }}
        >
          {fileName
            ? <FileSpreadsheet size={28} color="#ff4400" style={{ marginBottom: '10px' }} />
            : <Upload size={28} color="#ff4400" style={{ marginBottom: '10px' }} />
          }
          <span style={{ color: '#e0e0e0', fontWeight: '500', marginBottom: '4px', textAlign: 'center', fontSize: '14px' }}>
            {fileName || 'Clique ou arraste o arquivo aqui'}
          </span>
          <span style={{ color: '#666', fontSize: '12px' }}>
            {fileName ? 'Clique para escolher outro' : '.csv  ·  .xlsx  ·  .xls  (Profit / Nelogica)'}
          </span>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx,.xls,.txt"
            onChange={handleInputChange}
            style={{ display: 'none' }}
          />
        </div>

        {/* Colunas detectadas */}
        {detectedCols.length > 0 && !error && (
          <div style={{ marginBottom: '12px', padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', fontSize: '11px', color: '#666' }}>
            <strong style={{ color: '#555', display: 'block', marginBottom: '4px' }}>Colunas detectadas no arquivo:</strong>
            {detectedCols.join('  ·  ')}
          </div>
        )}

        {/* Erro */}
        {error && (
          <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(255,61,90,.1)', border: '1px solid rgba(255,61,90,.2)', display: 'flex', alignItems: 'flex-start', gap: '9px', marginBottom: '14px' }}>
            <AlertCircle size={15} color="#FF3D5A" style={{ marginTop: '2px', flexShrink: 0 }} />
            <span style={{ color: '#FF3D5A', fontSize: '13px', lineHeight: '1.5' }}>{error}</span>
          </div>
        )}

        {/* Preview */}
        {!error && parsedTrades.length > 0 && (
          <div style={{ padding: '14px', borderRadius: '8px', background: 'rgba(0,232,138,.08)', border: '1px solid rgba(0,232,138,.2)', marginBottom: '14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <strong style={{ color: '#00E88A', fontSize: '15px' }}>✓ Arquivo lido com sucesso!</strong>
            <span style={{ color: '#a0a0a0', fontSize: '13px' }}>
              <b style={{ color: '#e0e0e0' }}>{parsedTrades.length} operações</b> prontas para importar  ·  Resultado total:{' '}
              <b style={{ color: totalResult >= 0 ? '#00E88A' : '#FF3D5A' }}>{moneyBR(totalResult)}</b>
            </span>
            {defaultUsed && (
              <span style={{ color: '#888', fontSize: '11px' }}>
                ℹ️ Operações sem coluna "Conta" foram associadas a <strong>{defaultAccount}</strong>.
              </span>
            )}
          </div>
        )}

        <div className="modal-actions">
          <button type="button" className="outline-button" onClick={onClose}>Cancelar</button>
          <button
            type="button"
            className="primary-button"
            disabled={parsedTrades.length === 0}
            onClick={() => onImport(parsedTrades)}
          >
            <Check size={15} /> Importar{parsedTrades.length > 0 ? ` ${parsedTrades.length} operações` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
