const fs = require('fs');
let css = fs.readFileSync('src/index.css', 'utf-8');

css = css.replace(/\.bchart-bar\.pos \{[^}]+\}/, '.bchart-bar.pos { background: #00e676; border-radius: 3px 3px 0 0; }');

fs.writeFileSync('src/index.css', css, 'utf-8');
console.log('bchart fixed');