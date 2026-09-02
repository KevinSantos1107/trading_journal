const fs = require('fs');
let css = fs.readFileSync('src/index.css', 'utf-8');

// Helper to convert hex to HSL
function hexToHsl(hex) {
    hex = hex.replace(/^#/, '');
    if (hex.length === 3) {
        hex = hex.split('').map(c => c + c).join('');
    }
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;

    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
        h = s = 0;
    } else {
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

function hslToHex(h, s, l) {
    let r, g, b;
    h /= 360;
    if (s === 0) {
        r = g = b = l;
    } else {
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
    const toHex = x => {
        const hex = Math.round(x * 255).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Lines that contain financial semantic meaning (we don't touch their greens/reds)
const skipRegex = /\.(positive|profit|negative|loss|neutral|profit-bg|loss-bg|positive-bg|negative-bg|neutral-bg)/i;

const lines = css.split('\n');
const newLines = lines.map(line => {
    if (skipRegex.test(line)) {
        // Just make sure positive is pure green and negative is red
        let l = line.replace(/#00dfa0/ig, '#00e676').replace(/#fb6376/ig, '#ff3b5c');
        return l;
    }
    
    // Replace hex colors
    return line.replace(/#[0-9a-fA-F]{3,6}/g, (match) => {
        if(match.length !== 4 && match.length !== 7) return match;
        const [h, s, l] = hexToHsl(match);
        
        // If it's a green/teal/cyan hue (between 100 and 200 degrees)
        if (h > 100 && h < 200) {
            // Dark backgrounds -> pure black or very dark warm grey
            if (l < 0.25) {
                return hslToHex(20, 0.1, Math.min(l, 0.08)); // extremely dark warm grey
            }
            // Vivid accents (buttons, active states) -> Neon Orange
            else if (s > 0.4 && l > 0.4) {
                return '#ff5500'; 
            }
            // Muted text/borders -> Neutral/Warm greys
            else {
                return hslToHex(20, 0.05, l); // keep same lightness, but make it a warm grey
            }
        }
        return match;
    }).replace(/rgba\(\s*0\s*,\s*(2[0-5][0-5]|1[0-9][0-9])\s*,\s*[0-9]+\s*,/g, (match) => {
        // catch rgba(0, 230, 160, ...) and turn to orange rgba(255, 85, 0, ...)
        return 'rgba(255, 85, 0,';
    });
});

fs.writeFileSync('src/index.css', newLines.join('\n'), 'utf-8');
console.log('Complete visual overhaul done!');