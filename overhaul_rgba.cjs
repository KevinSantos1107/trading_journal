const fs = require('fs');
let css = fs.readFileSync('src/index.css', 'utf-8');

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

const skipRegex = /\.(positive|profit|negative|loss|neutral|profit-bg|loss-bg|positive-bg|negative-bg|neutral-bg)/i;

const lines = css.split('\n');
const newLines = lines.map(line => {
    if (skipRegex.test(line)) return line;
    
    return line.replace(/rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\.0-9]+)\s*\)/g, (match, r, g, b, a) => {
        const [h, s, l] = rgbToHsl(parseInt(r), parseInt(g), parseInt(b));
        
        // If it's in the green/teal range
        if (h > 100 && h < 200) {
            if (s > 0.3 && l > 0.3) {
                // Vivid green -> neon orange
                return `rgba(255, 85, 0, ${a})`;
            } else if (l < 0.25) {
                // Dark green background -> pure black / warm dark
                const [nr, ng, nb] = hslToRgb(20, 0.1, Math.min(l, 0.08));
                return `rgba(${nr}, ${ng}, ${nb}, ${a})`;
            } else {
                // Muted grey/green -> neutral grey
                const [nr, ng, nb] = hslToRgb(20, 0.05, l);
                return `rgba(${nr}, ${ng}, ${nb}, ${a})`;
            }
        }
        // Very dark backgrounds that might have low saturation but we want them completely black for Midnight Magma
        if (l < 0.15 && s < 0.3) {
           return `rgba(5, 2, 0, ${a})`; // almost pure black
        }
        return match;
    });
});

fs.writeFileSync('src/index.css', newLines.join('\n'), 'utf-8');
console.log('RGBA visual overhaul done!');