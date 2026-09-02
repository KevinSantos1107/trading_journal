const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const oldState = `  const [resultFilter, setResultFilter] = useState<'all' | 'gain' | 'loss' | 'breakeven'>('all');
  const [dayModal, setDayModal] = useState(false);
  const [viewTrade, setViewTrade] = useState<Trade | null>(null);
  const [viewStrategy, setViewStrategy] = useState<string | null>(null);
  const filteredTrades = useMemo(() => {
    if (resultFilter === 'all') return dateFilteredTrades;
    if (resultFilter === 'gain') return dateFilteredTrades.filter((t) => t.result > 0);
    if (resultFilter === 'loss') return dateFilteredTrades.filter((t) => t.result < 0);
    return dateFilteredTrades.filter((t) => t.result === 0);
  }, [dateFilteredTrades, resultFilter]);`;

const newState = `  const [resultFilter, setResultFilter] = useState<'all' | 'gain' | 'loss' | 'breakeven' | 'compra' | 'venda'>('all');
  const [dayModal, setDayModal] = useState(false);
  const [viewTrade, setViewTrade] = useState<Trade | null>(null);
  const [viewStrategy, setViewStrategy] = useState<string | null>(null);
  const filteredTrades = useMemo(() => {
    if (resultFilter === 'all') return dateFilteredTrades;
    if (resultFilter === 'gain') return dateFilteredTrades.filter((t) => t.result > 0);
    if (resultFilter === 'loss') return dateFilteredTrades.filter((t) => t.result < 0);
    if (resultFilter === 'breakeven') return dateFilteredTrades.filter((t) => t.result === 0);
    if (resultFilter === 'compra') return dateFilteredTrades.filter((t) => t.details?.direction === 'Compra');
    if (resultFilter === 'venda') return dateFilteredTrades.filter((t) => t.details?.direction === 'Venda');
    return dateFilteredTrades;
  }, [dateFilteredTrades, resultFilter]);`;

code = code.replace(oldState, newState);

const oldUI = `<SectionHeading title="Operações Recentes" />
        <div className="result-filters">
          <button className={resultFilter === 'all' ? 'active' : ''} onClick={() => setResultFilter('all')}>Todas <span>{dateFilteredTrades.length}</span></button>
          <button className={resultFilter === 'gain' ? 'active gain' : ''} onClick={() => setResultFilter('gain')}>Gain <span>{dateFilteredTrades.filter((t) => t.result > 0).length}</span></button>
          <button className={resultFilter === 'loss' ? 'active loss' : ''} onClick={() => setResultFilter('loss')}>Loss <span>{dateFilteredTrades.filter((t) => t.result < 0).length}</span></button>
          <button className={resultFilter === 'breakeven' ? 'active be' : ''} onClick={() => setResultFilter('breakeven')}>0 x 0 <span>{dateFilteredTrades.filter((t) => t.result === 0).length}</span></button>
        </div>`;

const newUI = `<SectionHeading title="Operações" />
        <div className="result-filters" style={{ flexWrap: 'wrap' }}>
          <button className={resultFilter === 'all' ? 'active' : ''} onClick={() => setResultFilter('all')}>Todas <span>{dateFilteredTrades.length}</span></button>
          <button className={resultFilter === 'gain' ? 'active gain' : ''} onClick={() => setResultFilter('gain')}>Gain <span>{dateFilteredTrades.filter((t) => t.result > 0).length}</span></button>
          <button className={resultFilter === 'loss' ? 'active loss' : ''} onClick={() => setResultFilter('loss')}>Loss <span>{dateFilteredTrades.filter((t) => t.result < 0).length}</span></button>
          <button className={resultFilter === 'breakeven' ? 'active be' : ''} onClick={() => setResultFilter('breakeven')}>0 x 0 <span>{dateFilteredTrades.filter((t) => t.result === 0).length}</span></button>
          <button className={resultFilter === 'compra' ? 'active buy' : ''} onClick={() => setResultFilter('compra')} style={{ marginLeft: '10px' }}>Compras <span>{dateFilteredTrades.filter((t) => t.details?.direction === 'Compra').length}</span></button>
          <button className={resultFilter === 'venda' ? 'active sell' : ''} onClick={() => setResultFilter('venda')}>Vendas <span>{dateFilteredTrades.filter((t) => t.details?.direction === 'Venda').length}</span></button>
        </div>`;

code = code.replace(oldUI, newUI);
fs.writeFileSync('src/App.tsx', code, 'utf-8');
console.log('App.tsx filter buttons updated');