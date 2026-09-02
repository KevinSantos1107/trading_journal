const fs = require('fs');
let css = fs.readFileSync('src/index.css', 'utf-8');

if (!css.includes('fonts.googleapis.com')) {
  css = `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');\n` + css;
}

const premiumCSS = `
/* =========================================
   PREMIUM REDESIGN V2
   ========================================= */
:root {
  --brand: #FF6A00;
  --brand-hover: #FF8A3D;
  --brand-bg: rgba(255, 106, 0, 0.08);

  --pos: #00E88A;
  --pos-bg: rgba(0, 232, 138, 0.08);
  --neg: #FF3D5A;
  --neg-bg: rgba(255, 61, 90, 0.08);
  --neu: #7A7A7A;
  --neu-bg: rgba(122, 122, 122, 0.08);

  --bg-base: #070707;
  --bg-sidebar: #090909;
  --bg-surface: #0D0D0E;
  --bg-card: #111111;
  --bg-card-elevated: #151515;
  --bg-modal: #121212;

  --border: #1F1F1F;
  --border-light: #2A2A2A;
  --border-brand: rgba(255, 106, 0, 0.3);

  --text-main: #F5F5F5;
  --text-muted: #888888;
  --text-dark: #555555;
}

body, html, #root, .app-shell, .main-content {
  background-color: var(--bg-base) !important;
  color: var(--text-main) !important;
  font-family: 'Inter', sans-serif !important;
}

.sidebar {
  background-color: var(--bg-sidebar) !important;
  border-right: 1px solid var(--border) !important;
}

.sidebar .active {
  background-color: var(--brand-bg) !important;
  color: var(--brand) !important;
  border-left: 3px solid var(--brand) !important;
  box-shadow: none !important;
}

/* Cards */
.stat-card, .metric-card, .chart-card, .strategy-card, .calendar-card, .focus-card, .donut-card, .note-card, .new-note-card {
  background: var(--bg-card) !important;
  border: 1px solid var(--border) !important;
  border-radius: 12px !important;
  box-shadow: 0 4px 20px rgba(0,0,0,0.2) !important;
  transition: all 0.2s ease !important;
}

.stat-card:hover, .strategy-card:hover, .metric-card:hover {
  background: var(--bg-card-elevated) !important;
  border-color: var(--border-light) !important;
  transform: translateY(-2px) !important;
  box-shadow: 0 8px 30px rgba(0,0,0,0.4) !important;
}

/* Modals */
.modal-overlay {
  background: rgba(0,0,0,0.75) !important;
  backdrop-filter: blur(5px) !important;
}

.modal-content {
  background: var(--bg-modal) !important;
  border: 1px solid var(--border-light) !important;
  border-radius: 16px !important;
  box-shadow: 0 24px 48px rgba(0,0,0,0.7) !important;
}

.modal-header h2, .modal-title {
  font-weight: 600 !important;
  color: var(--text-main) !important;
}

.modal-close {
  background: var(--bg-card) !important;
  border: 1px solid var(--border) !important;
  color: var(--text-muted) !important;
  border-radius: 8px !important;
  transition: all 0.2s;
}
.modal-close:hover {
  background: var(--bg-card-elevated) !important;
  color: var(--text-main) !important;
  border-color: var(--border-light) !important;
}

/* Financial Colors */
.c-pos, .positive, .tone-green .stat-value, .metric-card.tone-green strong, .strategy-result.positive, .hero-value.positive { color: var(--pos) !important; }
.c-neg, .negative, .tone-red .stat-value, .metric-card.tone-red strong, .strategy-result.negative, .hero-value.negative { color: var(--neg) !important; }
.c-neu, .neutral, .tone-neutral .stat-value, .metric-card.tone-neutral strong, .strategy-result.neutral, .hero-value.neutral { color: var(--neu) !important; }

/* Overrides for spans inside metric cards to fix opacity issue in previous css */
.metric-card.tone-green span { color: var(--pos) !important; opacity: 1 !important; }
.metric-card.tone-red span { color: var(--neg) !important; opacity: 1 !important; }
.metric-card.tone-neutral span { color: var(--neu) !important; opacity: 1 !important; }

/* W/L/BE Display */
.wl-be-display { display: flex; gap: 8px; font-weight: 600; font-family: 'Inter', sans-serif; font-size: 11px; margin-top: 6px; }

/* Strategy Card Hero */
.strategy-card { padding: 20px !important; display: flex; flex-direction: column; gap: 12px; }
.strat-header { display: flex; align-items: center; gap: 8px; font-weight: 600; color: var(--text-main); font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
.brand-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--brand); box-shadow: 0 0 8px var(--brand-bg); }
.strat-hero-val { font-size: 26px; font-weight: 700; font-family: 'Inter', sans-serif; margin-top: 4px; letter-spacing: -0.5px; }
.strat-stats { display: flex; justify-content: space-between; border-top: 1px solid var(--border); padding-top: 12px; margin-top: auto; font-size: 10px; color: var(--text-muted); text-transform: uppercase; font-weight: 500; }
.strat-stats b { font-size: 11px; }

/* Backgrounds for Strategy Cards based on result */
.strat-bg-pos { background: linear-gradient(180deg, var(--pos-bg) 0%, var(--bg-card) 100%) !important; border-top: 1px solid rgba(0, 232, 138, 0.2) !important; }
.strat-bg-neg { background: linear-gradient(180deg, var(--neg-bg) 0%, var(--bg-card) 100%) !important; border-top: 1px solid rgba(255, 61, 90, 0.2) !important; }
.strat-bg-neu { background: var(--bg-card) !important; }

/* Modal Hero Section */
.modal-hero {
  display: flex; gap: 16px; margin: 24px 0;
}
.hero-box {
  flex: 1;
  padding: 24px;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  border: 1px solid var(--border);
}
.hero-box.hb-pos { background: var(--pos-bg); border-color: rgba(0, 232, 138, 0.2); }
.hero-box.hb-neg { background: var(--neg-bg); border-color: rgba(255, 61, 90, 0.2); }
.hero-box.hb-neu { background: var(--bg-card); border-color: var(--border-light); }
.hero-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: var(--text-muted); font-weight: 600; }
.hero-value { font-size: 28px; font-weight: 700; font-family: 'Inter', sans-serif; letter-spacing: -0.5px; }
.hero-sub { font-size: 13px; font-weight: 600; font-family: 'Inter', sans-serif; }

/* Buttons */
.primary-button, .auth-submit, .btn-primary {
  background: var(--brand) !important;
  color: #fff !important;
  border: none !important;
  border-radius: 8px !important;
  font-weight: 600 !important;
  box-shadow: 0 4px 15px rgba(255, 106, 0, 0.2) !important;
  transition: all 0.2s !important;
}
.primary-button:hover, .auth-submit:hover, .btn-primary:hover {
  background: var(--brand-hover) !important;
  box-shadow: 0 6px 20px rgba(255, 106, 0, 0.3) !important;
  transform: translateY(-1px) !important;
}

/* Table (Operations) */
.history-table th { color: var(--text-muted) !important; font-weight: 600 !important; border-bottom: 1px solid var(--border) !important; text-transform: uppercase; letter-spacing: 0.5px; font-size: 10px; }
.history-table td { border-bottom: 1px solid var(--border) !important; color: var(--text-main) !important; font-size: 13px; padding: 16px 12px !important; }
.history-table tr:hover td { background: var(--bg-card-elevated) !important; }

/* Calendar Heatmap adjustments */
.calendar-grid .day-cell { border: 1px solid var(--border) !important; border-radius: 8px !important; background: var(--bg-card) !important; }
.calendar-grid .day-cell:hover { border-color: var(--border-light) !important; background: var(--bg-card-elevated) !important; }
.calendar-grid .day-cell.selected { border-color: var(--brand) !important; background: var(--brand-bg) !important; box-shadow: 0 0 0 1px var(--brand) !important; }
.calendar-grid .day-cell.d-pos { border-bottom: 3px solid var(--pos) !important; }
.calendar-grid .day-cell.d-neg { border-bottom: 3px solid var(--neg) !important; }

.cal-pos { color: var(--pos) !important; }
.cal-neg { color: var(--neg) !important; }

.bchart-bar.pos { background: var(--pos) !important; }
.bchart-bar.neg { background: var(--neg) !important; }

/* Typography Overrides */
h1, h2, h3, h4, strong, b { font-family: 'Inter', sans-serif !important; }
.stat-value, .strategy-result { font-family: 'Inter', sans-serif !important; font-weight: 700 !important; letter-spacing: -0.5px !important; }

/* Input/Select */
input, select, textarea {
  background: var(--bg-surface) !important;
  border: 1px solid var(--border) !important;
  color: var(--text-main) !important;
  border-radius: 8px !important;
  font-family: 'Inter', sans-serif !important;
}
input:focus, select:focus, textarea:focus {
  border-color: var(--brand) !important;
  box-shadow: 0 0 0 2px var(--brand-bg) !important;
  outline: none !important;
}

/* Metric Cards Details */
.metric-card {
   display: flex; flex-direction: column; justify-content: center; padding: 20px !important;
}
.metric-card strong { font-size: 24px !important; font-weight: 700 !important; letter-spacing: -0.5px !important; margin-top: 12px !important; }
.metric-card small { font-size: 11px !important; color: var(--text-muted) !important; margin-top: 4px !important; }
.stat-card { padding: 20px !important; }
.stat-value { font-size: 26px !important; }
.stat-meta { font-size: 11px !important; font-weight: 500 !important; }

/* Mobile tweaks */
@media (max-width: 768px) {
  .modal-hero { flex-direction: column; gap: 12px; }
  .strategy-grid, .stats-grid, .metric-grid { grid-template-columns: 1fr !important; }
  .hero-box { padding: 16px; }
  .hero-value { font-size: 24px; }
}
`;

fs.writeFileSync('src/index.css', css + premiumCSS, 'utf-8');
console.log('Premium CSS injected successfully.');