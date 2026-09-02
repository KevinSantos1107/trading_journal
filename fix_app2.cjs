const fs = require('fs');
let app = fs.readFileSync('src/App.tsx', 'utf-8');

app = app.replace(
    /className=\{\`strategy-result \$\{result < 0 \? 'negative' : ''\}\`\}/g,
    'className={`strategy-result ${getToneClass(result)}`}'
);

fs.writeFileSync('src/App.tsx', app, 'utf-8');
console.log('App.tsx strategy result fixed');