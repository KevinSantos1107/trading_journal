const fs = require('fs');
let css = fs.readFileSync('src/index.css', 'utf-8');

css = css.replace(/\.tone-green \.stat-value \{[^}]+\}/, '.tone-green .stat-value { color: #00e676; }');
css = css.replace(/\.tone-red \.stat-value \{[^}]+\}/, '.tone-red .stat-value { color: #ff3b5c; }');
// if tone-neutral doesn't exist, we can just append it
if(!css.includes('.tone-neutral .stat-value')) {
    css += '\n.tone-neutral .stat-value { color: #8a9e97; }';
} else {
    css = css.replace(/\.tone-neutral \.stat-value \{[^}]+\}/, '.tone-neutral .stat-value { color: #8a9e97; }');
}

css = css.replace(/\.strategy-result \{([^}]+)color:\s*#[0-9a-fA-F]+;/i, '.strategy-result {$1color: #8a9e97;'); 
css = css.replace(/\.strategy-result\.negative,\s*.negative\s*\{[^}]+\}/i, '.strategy-result.negative, .negative { color: #ff3b5c; }\n.strategy-result.positive, .positive { color: #00e676 !important; }');

css = css.replace(/\.tone-green \.stat-label \{[^}]+\}/, '.tone-green .stat-label { color: #00e676; }');
css = css.replace(/\.tone-red \.stat-label \{[^}]+\}/, '.tone-red .stat-label { color: #ff3b5c; }');
if(!css.includes('.tone-neutral .stat-label')) {
    css += '\n.tone-neutral .stat-label { color: #8a9e97; }';
}

fs.writeFileSync('src/index.css', css, 'utf-8');
console.log('index.css tones fixed');