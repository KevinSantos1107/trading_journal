const fs = require('fs');
let app = fs.readFileSync('src/App.tsx', 'utf-8');

// Dashboard Resultado Total
app = app.replace(
    /tone="green" chart={<MiniSpark values=\{equity\} \/>}/,
    'tone={stats.totalResult > 0 ? "green" : stats.totalResult < 0 ? "red" : "neutral"} chart={<MiniSpark values={equity} />}'
);

// Dashboard Win Rate
app = app.replace(
    /tone="green" chart={<Ring value=\{stats.winRate\} \/>}/,
    'tone={stats.winRate >= 50 ? "green" : "red"} chart={<Ring value={stats.winRate} />}'
);

// History W/L
app = app.replace(
    /icon={<Gauge size=\{17\} \/>} tone="green" \/>/,
    'icon={<Gauge size={17} />} tone={monthWins >= monthLosses ? "green" : "red"} />'
);

// History Resultado do mês
app = app.replace(
    /tone=\{monthResult >= 0 \? 'green' : 'red'\}/,
    'tone={monthResult > 0 ? "green" : monthResult < 0 ? "red" : "neutral"}'
);

// MiniSpark SVG Equity Gradient
app = app.replace(
    /<linearGradient id="equityArea" x1="0" x2="0" y1="0" y2="1">[\s\S]*?<\/linearGradient>/,
    `<linearGradient id="equityArea" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#ff4400" stopOpacity=".35" />
              <stop offset="100%" stopColor="#ff4400" stopOpacity="0" />
            </linearGradient>`
);
app = app.replace(
    /<polyline points=\{line\} fill="none" stroke="#00e6a0"/,
    '<polyline points={line} fill="none" stroke="#ff4400"'
);

// HorizontalBars color 
app = app.replace(
    /background: result > 0 \? '#00d696' : result < 0 \? '#fb6376' : '#3a5a52'/g,
    "background: result > 0 ? '#00e676' : result < 0 ? '#ff3b5c' : '#777777'"
);

fs.writeFileSync('src/App.tsx', app, 'utf-8');
console.log('App.tsx fixed');