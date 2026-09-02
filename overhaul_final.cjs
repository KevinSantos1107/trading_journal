const fs = require('fs');
let css = fs.readFileSync('src/index.css', 'utf-8');

// Un-minify slightly so each rule is on its own line
css = css.replace(/}/g, '}\n');

function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max === min) { h = s = 0; } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return [h * 360, s, l];
}

function hslToRgb(h, s, l) {
    let r, g, b;
    h /= 360;
    if (s === 0) { r = g = b = l; } else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}
function toHex(c) {
    const hex = c.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
}

const skipRegex = /\.(positive|profit|negative|loss|neutral)(-[a-z]+)?\b/i;

const rules = css.split('\n');
const newRules = rules.map(rule => {
    if (skipRegex.test(rule)) {
        // Just make sure positive is pure green and negative is red
        return rule.replace(/#00dfa0/ig, '#00e676').replace(/#fb6376/ig, '#ff3b5c');
    }
    
    // Replace hex colors
    rule = rule.replace(/#[0-9a-fA-F]{3,6}\b/g, (match) => {
        if(match.length !== 4 && match.length !== 7) return match;
        // manually convert hex to rgb
        let hex = match.replace('#', '');
        if (hex.length === 3) hex = hex.split('').map(c => c+c).join('');
        const r = parseInt(hex.substring(0,2), 16);
        const g = parseInt(hex.substring(2,4), 16);
        const b = parseInt(hex.substring(4,6), 16);
        const [h, s, l] = rgbToHsl(r, g, b);
        
        if (h > 100 && h < 200) {
            if (l < 0.25) {
                const [nr, ng, nb] = hslToRgb(20, 0.1, Math.min(l, 0.08));
                return `#${toHex(nr)}${toHex(ng)}${toHex(nb)}`;
            } else if (s > 0.4 && l > 0.4) {
                return '#ff4400'; 
            } else {
                const [nr, ng, nb] = hslToRgb(20, 0.05, l);
                return `#${toHex(nr)}${toHex(ng)}${toHex(nb)}`;
            }
        }
        return match;
    });

    // Replace RGBA colors
    rule = rule.replace(/rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\.0-9]+)\s*\)/g, (match, r, g, b, a) => {
        const [h, s, l] = rgbToHsl(parseInt(r), parseInt(g), parseInt(b));
        if (h > 100 && h < 200) {
            if (s > 0.3 && l > 0.3) {
                return `rgba(255, 68, 0, ${a})`;
            } else if (l < 0.25) {
                const [nr, ng, nb] = hslToRgb(20, 0.1, Math.min(l, 0.08));
                return `rgba(${nr}, ${ng}, ${nb}, ${a})`;
            } else {
                const [nr, ng, nb] = hslToRgb(20, 0.05, l);
                return `rgba(${nr}, ${ng}, ${nb}, ${a})`;
            }
        }
        if (l < 0.15 && s < 0.3) {
           return `rgba(5, 2, 0, ${a})`; 
        }
        return match;
    });

    return rule;
});

fs.writeFileSync('src/index.css', newRules.join('\n').replace(/\n\s*$/g, ''), 'utf-8');
console.log('Complete unminified visual overhaul done!');