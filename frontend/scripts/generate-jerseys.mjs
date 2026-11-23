import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outDir = path.resolve(__dirname, '../public/jerseys');

if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
}

const KITS = [
    { id: 'chiefs', primary: '#FDB913', secondary: '#000000', accent: '#000000', collar: '#000000', sleeve: '#FDB913', style: 'stripes' },
    { id: 'pirates', primary: '#121212', secondary: '#FFFFFF', accent: '#D31E28', collar: '#FFFFFF', sleeve: '#121212', style: 'plain' },
    { id: 'sundowns', primary: '#FFD200', secondary: '#0080C8', accent: '#005C29', collar: '#0080C8', sleeve: '#FFD200', style: 'plain' },
    { id: 'stellenbosch', primary: '#6B1D2F', secondary: '#D4AF37', accent: '#D4AF37', collar: '#D4AF37', sleeve: '#D4AF37', style: 'plain' },
    { id: 'supersport', primary: '#003882', secondary: '#FFFFFF', accent: '#E31B23', collar: '#FFFFFF', sleeve: '#FFFFFF', style: 'plain' },
    { id: 'capetowncity', primary: '#1A2849', secondary: '#E6B325', accent: '#E6B325', collar: '#E6B325', sleeve: '#1A2849', style: 'sash' },
    { id: 'amazulu', primary: '#005C29', secondary: '#FFFFFF', accent: '#FFFFFF', collar: '#FFFFFF', sleeve: '#005C29', style: 'plain' },
    { id: 'chippa', primary: '#E31B23', secondary: '#003366', accent: '#003366', collar: '#003366', sleeve: '#003366', style: 'plain' },
    { id: 'goldenarrows', primary: '#006837', secondary: '#FFD200', accent: '#FFD200', collar: '#FFD200', sleeve: '#006837', style: 'stripes' },
    { id: 'polokwane', primary: '#F37021', secondary: '#1A1A1A', accent: '#1A1A1A', collar: '#1A1A1A', sleeve: '#F37021', style: 'plain' },
    { id: 'richardsbay', primary: '#1B4F72', secondary: '#FFFFFF', accent: '#FFFFFF', collar: '#FFFFFF', sleeve: '#1B4F72', style: 'plain' },
    { id: 'sekhukhune', primary: '#800020', secondary: '#87CEEB', accent: '#87CEEB', collar: '#87CEEB', sleeve: '#87CEEB', style: 'plain' },
    { id: 'tsgalaxy', primary: '#B81D24', secondary: '#1A1A1A', accent: '#1A1A1A', collar: '#1A1A1A', sleeve: '#1A1A1A', style: 'stripes' },
    { id: 'magesi', primary: '#0D47A1', secondary: '#2E7D32', accent: '#2E7D32', collar: '#2E7D32', sleeve: '#0D47A1', style: 'plain' },
    { id: 'marumo', primary: '#E65100', secondary: '#0D47A1', accent: '#0D47A1', collar: '#0D47A1', sleeve: '#E65100', style: 'plain' },
    { id: 'durbancity', primary: '#0F172A', secondary: '#EAB308', accent: '#EAB308', collar: '#EAB308', sleeve: '#0F172A', style: 'stripes' },
    { id: 'gk', primary: '#10B981', secondary: '#064E3B', accent: '#000000', collar: '#064E3B', sleeve: '#10B981', style: 'plain' }
];

const generateSvg = (kit) => `<?xml version="1.0" encoding="UTF-8"?>
<svg width="128" height="128" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="crease" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#000" stop-opacity="0.15"/>
      <stop offset="30%" stop-color="#fff" stop-opacity="0.1"/>
      <stop offset="50%" stop-color="#000" stop-opacity="0"/>
      <stop offset="70%" stop-color="#fff" stop-opacity="0.1"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0.15"/>
    </linearGradient>
    <pattern id="stripes" width="20" height="100" patternUnits="userSpaceOnUse">
      <rect x="0" y="0" width="10" height="100" fill="${kit.primary}"/>
      <rect x="10" y="0" width="10" height="100" fill="${kit.secondary}"/>
    </pattern>
    <clipPath id="body-clip">
      <path d="M 28 20 L 72 20 L 76 86 L 24 86 Z"/>
    </clipPath>
  </defs>
  <!-- Left Sleeve -->
  <path d="M 28 20 L 10 38 L 22 52 L 28 40 Z" fill="${kit.sleeve}" stroke="#000" stroke-width="1.2" stroke-opacity="0.25"/>
  <path d="M 10 38 L 22 52" stroke="${kit.accent}" stroke-width="3" stroke-linecap="round"/>
  <!-- Right Sleeve -->
  <path d="M 72 20 L 90 38 L 78 52 L 72 40 Z" fill="${kit.sleeve}" stroke="#000" stroke-width="1.2" stroke-opacity="0.25"/>
  <path d="M 90 38 L 78 52" stroke="${kit.accent}" stroke-width="3" stroke-linecap="round"/>
  <!-- Main Torso -->
  <path d="M 28 20 Q 50 25 72 20 L 76 86 Q 50 89 24 86 Z" fill="${kit.style === 'stripes' ? 'url(#stripes)' : kit.primary}" stroke="#000" stroke-width="1.2" stroke-opacity="0.25"/>
  ${kit.style === 'sash' ? `<path d="M 26 22 L 72 84 L 76 86 L 76 72 L 34 20 Z" fill="${kit.secondary}" clip-path="url(#body-clip)"/>` : ''}
  <!-- Lighting -->
  <path d="M 28 20 Q 50 25 72 20 L 76 86 Q 50 89 24 86 Z" fill="url(#crease)"/>
  <!-- Collar -->
  <path d="M 38 20 Q 50 36 62 20 Q 50 26 38 20 Z" fill="${kit.collar}" stroke="#000" stroke-width="0.8" stroke-opacity="0.2"/>
  <!-- Club Badge Dot -->
  <circle cx="37" cy="38" r="3.2" fill="${kit.secondary}" opacity="0.9"/>
</svg>`;

for (const kit of KITS) {
    const filename = path.join(outDir, `${kit.id}-kit.svg`);
    fs.writeFileSync(filename, generateSvg(kit), 'utf8');
}

console.log(`Generated ${KITS.length} PSL team kit SVGs in ${outDir}!`);
