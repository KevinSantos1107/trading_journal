const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

// 1. Remove technicalReading and replace with imageUrl in TradeDetailsModal
code = code.replace(/d\?\.technicalReading/g, 'd?.imageUrl');
code = code.replace(/\{d\?\.imageUrl && <div className="tdet-text-block"><span className="tdet-label">Leitura técnica<\/span><p>\{d\.imageUrl\}<\/p><\/div>\}/g, 
  `{d?.imageUrl && <div className="tdet-text-block tdet-print">
     <span className="tdet-label">Print da Operação</span>
     <div className="trade-print-preview" onClick={() => window.open(d.imageUrl, '_blank')}>
       <img src={d.imageUrl} alt="Print" />
       <div className="print-overlay"><span>🔍 Ampliar</span></div>
     </div>
   </div>}`);
// Oh wait, the regex above had encoding issues in the terminal output. Let's do it safer.

fs.writeFileSync('replace.cjs', `
const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

code = code.replace(/\\(d\\?\\.emotion \\|\\| d\\?\\.technicalReading\\)/g, '(d?.emotion || d?.imageUrl)');
code = code.replace(/\\{d\\?\\.technicalReading && <div className="tdet-text-block"><span className="tdet-label">Leitura t.cnica<\\/span><p>\\{d\\.technicalReading\\}<\\/p><\\/div>\\}/g, \`\\{d?.imageUrl && <div className="tdet-text-block tdet-print">
  <span className="tdet-label">Print da Operação</span>
  <div className="trade-print-preview" onClick={() => window.open(d.imageUrl, '_blank')}>
    <img src={d.imageUrl} alt="Print" />
    <div className="print-overlay"><span>🔍 Ampliar</span></div>
  </div>
</div>\\}\`);

code = code.replace(/margin-top: d\\?\\.emotion \\|\\| d\\?\\.technicalReading \\? 16 : 0/g, 'margin-top: d?.emotion || d?.imageUrl ? 16 : 0');
code = code.replace(/!d\\?\\.technicalReading/g, '!d?.imageUrl');

fs.writeFileSync('src/App.tsx', code, 'utf-8');
`);