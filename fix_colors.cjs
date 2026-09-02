const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

code = code.replace(/#00e676/g, '#00E88A');
code = code.replace(/#ff3b5c/g, '#FF3D5A');

fs.writeFileSync('src/App.tsx', code, 'utf-8');
console.log('Colors in App.tsx unified.');