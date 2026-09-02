const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

// 1. StatCard Types
code = code.replace(/meta: string;/g, 'meta: React.ReactNode;');

// 2. Format WL BE inside StatCards
const formatWLBE = 'meta={<span className="wl-be-display"><span className="c-pos">{stats.wins} W</span> <span className="c-neu">{stats.breakeven} BE</span> <span className="c-neg">{stats.losses} L</span></span>}';
code = code.replace(/meta=\{`\$\{stats\.wins\} W • \$\{stats\.breakeven\} BE • \$\{stats\.losses\} L`\}/g, formatWLBE);

// 3. Format W/L in History
const historyWLBE = 'meta={<span className="wl-be-display"><span className="c-pos">{monthWins} W</span> <span className="c-neg">{monthLosses} L</span></span>}';
code = code.replace(/value=\{`\$\{monthWins\} W \/ \$\{monthLosses\} L`\} meta="vitórias e perdas"/g, `value={\`\${monthWins} W / \${monthLosses} L\`} ${historyWLBE}`);

// 4. History Card 
code = code.replace(/value=\{`\$\{monthWins\} W  \/  \$\{monthLosses\} L`\} meta="vitórias e perdas"/g, `value={\`\${monthWins} W / \${monthLosses} L\`} ${historyWLBE}`);

// 5. Strategy Cards in Dashboard
const stratCardsRegex = /<div className="dashboard-grid strategy-grid">([\s\S]*?)<\/div>/;
const newStratCards = `<div className="dashboard-grid strategy-grid">
            {stats.strategyPerformance.slice(0, 4).map((strat) => {
              const tClass = getToneClass(strat.totalResult);
              const bgClass = tClass === 'positive' ? 'strat-bg-pos' : tClass === 'negative' ? 'strat-bg-neg' : 'strat-bg-neu';
              return (
                <div className={\`strategy-card \${bgClass}\`} key={strat.strategy} onClick={() => setStratModal(strat.strategy)} style={{cursor: 'pointer'}}>
                  <div className="strat-header"><span className="brand-dot"></span><span style={{flex: 1}}>{strat.strategy}</span><MoreHorizontal size={14} /></div>
                  <div className={\`strat-hero-val c-\${tClass.slice(0,3)}\`}>{money(strat.totalResult)}</div>
                  <div className="strat-stats">
                    <span>WIN RATE: <b className={strat.winRate >= 50 ? 'c-pos' : 'c-neg'}>{strat.winRate.toFixed(1)}%</b></span>
                    <span>{strat.count} OPS</span>
                  </div>
                  <div className="strat-stats" style={{borderTop: 'none', paddingTop: 0}}>
                    <span>MÉDIA/OP: <b className={\`c-\${getToneClass(strat.average).slice(0,3)}\`}>{money(strat.average)}</b></span>
                  </div>
                </div>
              );
            })}
          </div>`;
code = code.replace(stratCardsRegex, newStratCards);

// 6. TradeDetailsModal Hero
const detailsModalRegex = /<div className="protocol-titlebar">([\s\S]*?)<\/div>/;
const detailsModalReplacement = `<div className="protocol-titlebar">$1</div>
            <div className="modal-hero">
              <div className={\`hero-box hb-\${getToneClass(t.result).slice(0,3)}\`}>
                 <span className="hero-label">Resultado Financeiro</span>
                 <span className={\`hero-value c-\${getToneClass(t.result).slice(0,3)}\`}>{money(t.result)}</span>
              </div>
              <div className={\`hero-box hb-\${t.direction === 'Compra' ? 'pos' : 'neg'}\`}>
                 <span className="hero-label">Direção</span>
                 <span className={\`hero-sub c-\${t.direction === 'Compra' ? 'pos' : 'neg'}\`}>{t.direction === 'Compra' ? '▲ Compra' : '▼ Venda'}</span>
              </div>
            </div>`;
code = code.replace(detailsModalRegex, detailsModalReplacement);

// 7. Strategy Modal Hero
const stratModalTitlebarRegex = /<div className="modal-titlebar">\s*<div className="title-left">\s*<div className="brand-indicator"><\/div>\s*<h2>PERFORMANCE POR ESTRATÉGIA<\/h2>\s*<\/div>\s*<button className="modal-close" onClick={onClose}><X size={16} \/><\/button>\s*<\/div>\s*<h3 className="strategy-focus-title">\{strategy\}<\/h3>\s*<div className="stat-card focus-card">/m;
const stratModalReplacement = `<div className="modal-titlebar">
          <div className="title-left">
            <div className="brand-indicator"></div>
            <h2>PERFORMANCE POR ESTRATÉGIA</h2>
          </div>
          <button className="modal-close" onClick={onClose}><X size={16} /></button>
        </div>
        <h3 className="strategy-focus-title">{strategy}</h3>
        <div className="modal-hero">
          <div className={\`hero-box hb-\${getToneClass(stratStats.totalResult).slice(0,3)}\`}>
             <span className="hero-label">Resultado Total</span>
             <span className={\`hero-value c-\${getToneClass(stratStats.totalResult).slice(0,3)}\`}>{money(stratStats.totalResult)}</span>
          </div>
        </div>
        <div className="stat-card focus-card" style={{display: 'none'}}>`;
// Using replace with a bit more flexible regex might be tricky, so let's do targeted string replace.

const stratModalOld = `<h3 className="strategy-focus-title">{strategy}</h3>
        <div className="stat-card focus-card">
          <span className="stat-label">RESULTADO TOTAL</span>
          <span className={\`stat-value \${getToneClass(stratStats.totalResult)}\`}>{money(stratStats.totalResult)}</span>
        </div>`;
const stratModalNew = `<h3 className="strategy-focus-title">{strategy}</h3>
        <div className="modal-hero">
          <div className={\`hero-box hb-\${getToneClass(stratStats.totalResult).slice(0,3)}\`}>
             <span className="hero-label">Resultado Total</span>
             <span className={\`hero-value c-\${getToneClass(stratStats.totalResult).slice(0,3)}\`}>{money(stratStats.totalResult)}</span>
          </div>
        </div>`;
code = code.replace(stratModalOld, stratModalNew);


// 8. Strategy Modal W/L/BE
const stratStatsWLBE = 'meta={<span className="wl-be-display"><span className="c-pos">{stratStats.wins} W</span> <span className="c-neu">{stratStats.breakeven} BE</span> <span className="c-neg">{stratStats.losses} L</span></span>}';
code = code.replace(/meta=\{`\$\{stratStats\.wins\} W • \$\{stratStats\.breakeven\} BE • \$\{stratStats\.losses\} L`\}/g, stratStatsWLBE);

// 9. Fix Metric Cards span output inside StrategyModal and general
code = code.replace(/<span>por trade<\/span>/g, '<small>por trade</small>');
code = code.replace(/<span>razão média<\/span>/g, '<small>razão média</small>');
code = code.replace(/<span>ganho \/ perda total<\/span>/g, '<small>ganho / perda total</small>');

// 10. Update Equity Curve Green/Red hexes
code = code.replace(/const equityColor = finalValue >= 0 \? '#00e676' : '#ff3b5c';/g, "const equityColor = finalValue >= 0 ? '#00E88A' : '#FF3D5A';");
code = code.replace(/<stop offset="0%" stopColor=\{equityColor\} stopOpacity=\{0\.3\} \/>/g, "<stop offset=\"0%\" stopColor={equityColor} stopOpacity={0.4} />");

fs.writeFileSync('src/App.tsx', code, 'utf-8');
console.log('App.tsx React structure updated.');