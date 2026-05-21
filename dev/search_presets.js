const fs = require('fs');
const path = require('path');

const panelJsPath = 'C:\\Users\\Minguri\\Downloads\\free plugin\\free plugin\\Flow v1.5.2\\Flow v1.5.2\\panel\\js\\panel.js';
const content = fs.readFileSync(panelJsPath, 'utf8');

// Search for preset style properties or layout width settings
const regex = /\.style\.width\s*=\s*|presetGrid|presetCard|\.preset/g;
let match;
const found = [];
while ((match = regex.exec(content)) !== null) {
  found.push(match);
}

console.log('Total matches:', found.length);
found.slice(0, 50).forEach(m => {
  const idx = m.index;
  const start = Math.max(0, idx - 100);
  const end = Math.min(content.length, idx + 100);
  const snippet = content.substring(start, end).replace(/\r?\n/g, ' ');
  console.log(`[Pos ${idx}] ... ${snippet} ...`);
});
