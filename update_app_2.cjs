const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const oldState = `  const [filterMode, setFilterMode] = useState<'today' | 'week' | 'month' | 'all'>('month');
  const [showFilter, setShowFilter] = useState(false);

  const dateFilteredTrades = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    if (filterMode === 'all') return trades;
    if (filterMode === 'today') return trades.filter(t => t.date === todayStr);
    if (filterMode === 'week') {
      const w = new Date(now); w.setDate(w.getDate() - w.getDay());
      const weekStr = w.toISOString().slice(0, 10);
      return trades.filter(t => t.date >= weekStr && t.date <= todayStr);
    }
    if (filterMode === 'month') {
      const monthStr = \`\${todayStr.slice(0, 7)}-01\`;
      return trades.filter(t => t.date >= monthStr && t.date <= todayStr);
    }
    return trades;
  }, [trades, filterMode]);`;

const newState = `  const [filterMode, setFilterMode] = useState<'today' | 'week' | 'month' | 'all' | 'custom'>('month');
  const [showFilter, setShowFilter] = useState(false);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  const dateFilteredTrades = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    if (filterMode === 'all') return trades;
    if (filterMode === 'today') return trades.filter(t => t.date === todayStr);
    if (filterMode === 'week') {
      const w = new Date(now); w.setDate(w.getDate() - w.getDay());
      const weekStr = w.toISOString().slice(0, 10);
      return trades.filter(t => t.date >= weekStr && t.date <= todayStr);
    }
    if (filterMode === 'month') {
      const monthStr = \`\${todayStr.slice(0, 7)}-01\`;
      return trades.filter(t => t.date >= monthStr && t.date <= todayStr);
    }
    if (filterMode === 'custom') {
      return trades.filter(t => {
        if (customStartDate && t.date < customStartDate) return false;
        if (customEndDate && t.date > customEndDate) return false;
        return true;
      });
    }
    return trades;
  }, [trades, filterMode, customStartDate, customEndDate]);`;

code = code.replace(oldState, newState);
fs.writeFileSync('src/App.tsx', code, 'utf-8');
console.log('App.tsx Dashboard states updated');