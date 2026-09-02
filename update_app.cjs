const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

// I need to import deleteTradeImage
code = code.replace(/cleanupOldTrades,/, "cleanupOldTrades, deleteTradeImage,");

// Now inject inside saveTrade
const saveTradeRegex = /const saveTrade = \(trade: Trade\) => \{/m;
const saveTradeNew = `const saveTrade = (trade: Trade) => {
    if (editingTrade) {
      const oldUrl = editingTrade.details?.imageUrl;
      const newUrl = trade.details?.imageUrl;
      if (oldUrl && oldUrl !== newUrl) {
        deleteTradeImage(oldUrl).catch(console.error);
      }
    }`;
code = code.replace(saveTradeRegex, saveTradeNew);

fs.writeFileSync('src/App.tsx', code, 'utf-8');
console.log('App.tsx saveTrade updated to handle old image deletion.');