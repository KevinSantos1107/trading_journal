const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

// 1. Add viewStrategy click
code = code.replace(
  /<StrategyDetailModal strategy=\{viewStrategy\} trades=\{trades\} onClose=\{\(\) => setViewStrategy\(null\)\} \/>/g,
  `<StrategyDetailModal strategy={viewStrategy} trades={trades} onClose={() => setViewStrategy(null)} onViewTrade={(t) => { setViewStrategy(null); setViewTrade(t); }} />`
);

// 2. Fix sidebar profile click
code = code.replace(
  /<div className="profile"><div className="avatar">\{initials\}<\/div><div style=\{\{ overflow: 'hidden' \}\}><strong>\{displayName\}<\/strong><span style=\{\{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' \}\}>\{session\.user\.email\}<\/span><\/div><MoreHorizontal size=\{17\} \/><\/div>/g,
  `<div className="profile" style={{ cursor: 'pointer' }} onClick={() => { setEditProfileName(displayName); setShowEditProfile(true); }}><div className="avatar">{initials}</div><div style={{ overflow: 'hidden' }}><strong>{displayName}</strong><span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{session.user.email}</span></div><MoreHorizontal size={17} /></div>`
);

fs.writeFileSync('src/App.tsx', code, 'utf-8');
console.log('App.tsx updated (steps 1 and 2)');