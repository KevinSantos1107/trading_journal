const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const oldDropdown = `<div className="filter-dropdown">
                  <h4>Período</h4>
                  <button className={\`filter-opt \${filterMode === 'today' ? 'active' : ''}\`} onClick={() => { setFilterMode('today'); setShowFilter(false); }}>Hoje</button>
                  <button className={\`filter-opt \${filterMode === 'week' ? 'active' : ''}\`} onClick={() => { setFilterMode('week'); setShowFilter(false); }}>Esta Semana</button>
                  <button className={\`filter-opt \${filterMode === 'month' ? 'active' : ''}\`} onClick={() => { setFilterMode('month'); setShowFilter(false); }}>Este Mês</button>
                  <button className={\`filter-opt \${filterMode === 'all' ? 'active' : ''}\`} onClick={() => { setFilterMode('all'); setShowFilter(false); }}>Todo o período</button>
                </div>`;

const newDropdown = `<div className="filter-dropdown" style={{ width: '220px' }}>
                  <h4>Período</h4>
                  <button className={\`filter-opt \${filterMode === 'today' ? 'active' : ''}\`} onClick={() => { setFilterMode('today'); setShowFilter(false); }}>Hoje</button>
                  <button className={\`filter-opt \${filterMode === 'week' ? 'active' : ''}\`} onClick={() => { setFilterMode('week'); setShowFilter(false); }}>Esta Semana</button>
                  <button className={\`filter-opt \${filterMode === 'month' ? 'active' : ''}\`} onClick={() => { setFilterMode('month'); setShowFilter(false); }}>Este Mês</button>
                  <button className={\`filter-opt \${filterMode === 'all' ? 'active' : ''}\`} onClick={() => { setFilterMode('all'); setShowFilter(false); }}>Todo o período</button>
                  <button className={\`filter-opt \${filterMode === 'custom' ? 'active' : ''}\`} onClick={() => setFilterMode('custom')}>Data Personalizada</button>
                  {filterMode === 'custom' && (
                    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label style={{ fontSize: 10, color: '#958e8a' }}>De:<input type="date" value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)} style={{ width: '100%', padding: '6px', background: '#161412', border: '1px solid #3d1600', color: '#e0dedd', borderRadius: 4, marginTop: 2 }} /></label>
                      <label style={{ fontSize: 10, color: '#958e8a' }}>Até:<input type="date" value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} style={{ width: '100%', padding: '6px', background: '#161412', border: '1px solid #3d1600', color: '#e0dedd', borderRadius: 4, marginTop: 2 }} /></label>
                    </div>
                  )}
                </div>`;

code = code.replace(oldDropdown, newDropdown);
fs.writeFileSync('src/App.tsx', code, 'utf-8');
console.log('App.tsx filter dropdown updated');