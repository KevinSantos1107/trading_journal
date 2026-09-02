const fs = require('fs');
let css = fs.readFileSync('src/index.css', 'utf-8');

css = css.replace(/#0a0a0a/gi, '#000000');
css = css.replace(/#050505/gi, '#000000');
css = css.replace(/#141414/gi, '#0a0502');
css = css.replace(/#1a1a1a/gi, '#120803');
css = css.replace(/#111111/gi, '#080300');
css = css.replace(/#0d0d0d/gi, '#050200');
css = css.replace(/#202020/gi, '#1f0d04');

css = css.replace(/#222222/gi, '#331200');
css = css.replace(/#262626/gi, '#3d1600');
css = css.replace(/#2a2a2a/gi, '#4d1a00');

css = css.replace(/#ff8800/gi, '#ff4400');
css = css.replace(/#e67a00/gi, '#cc3600');
css = css.replace(/rgba\(255,\s*136,\s*0/gi, 'rgba(255, 68, 0');

const glowOverrides = `
/* Midnight Magma Overrides */
.app-shell, .sidebar { background: #000000; }
.primary-button, .auth-submit, .direction-buttons .buy.selected, .op-badge.add { 
  background: linear-gradient(135deg, #ff5500, #ff1100) !important;
  border: none !important;
  color: #fff !important;
  box-shadow: 0 4px 15px rgba(255, 68, 0, 0.4) !important;
  text-shadow: 0 1px 3px rgba(0,0,0,0.5);
}
.primary-button:hover, .auth-submit:hover {
  box-shadow: 0 6px 20px rgba(255, 68, 0, 0.6) !important;
  transform: translateY(-1px);
}
.sidebar .active {
  background: rgba(255, 68, 0, 0.1) !important;
  color: #ff4400 !important;
  border-left: 3px solid #ff4400 !important;
  box-shadow: inset 10px 0 20px rgba(255, 68, 0, 0.05);
}
.stat-card-clickable:hover {
  border-color: #ff4400 !important;
  box-shadow: 0 0 0 1px rgba(255, 68, 0, 0.3), 0 8px 24px rgba(255, 68, 0, 0.15) !important;
}
.stat-card h3 { color: #ff4400 !important; }
.bchart-bars-area .positive-bar { fill: #00e676 !important; }
.bchart-bars-area .negative-bar { fill: #ff1100 !important; }
.live-indicator.market-open .pulse { background: #ff4400; box-shadow: 0 0 8px #ff4400; }
.live-indicator.market-open { color: #ff4400; border-color: rgba(255,68,0,0.3); background: rgba(255,68,0,0.1); }
`;

fs.writeFileSync('src/index.css', css + glowOverrides, 'utf-8');
console.log('Midnight Magma applied successfully!');