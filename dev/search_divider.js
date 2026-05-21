const fs = require('fs');
const panelJsPath = 'C:\\Users\\Minguri\\Downloads\\free plugin\\free plugin\\Flow v1.5.2\\Flow v1.5.2\\panel\\js\\panel.js';
const content = fs.readFileSync(panelJsPath, 'utf8');

// Search for Divider position or PrefsHandler or similar
const keywords = ['getPositionFromPrefs', 'Divider.setPosition', 'defaultPosition', 'maxGraphSize'];
keywords.forEach(keyword => {
  console.log(`=== Matches for: ${keyword} ===`);
  let idx = 0;
  while (true) {
    idx = content.indexOf(keyword, idx);
    if (idx === -1) break;
    const start = Math.max(0, idx - 150);
    const end = Math.min(content.length, idx + 150);
    const snippet = content.substring(start, end).replace(/\r?\n/g, ' ');
    console.log(`[Pos ${idx}] ... ${snippet} ...`);
    idx += keyword.length;
  }
});
