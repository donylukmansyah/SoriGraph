const fs = require('fs');
const path = require('path');

const panelJsPath = 'C:\\Users\\Minguri\\Downloads\\free plugin\\free plugin\\Flow v1.5.2\\Flow v1.5.2\\panel\\js\\panel.js';
if (!fs.existsSync(panelJsPath)) {
  console.log('File does not exist:', panelJsPath);
  process.exit(1);
}

const content = fs.readFileSync(panelJsPath, 'utf8');

// Let's search for "resize" or "flexBasis" or ".offsetWidth" or ".offsetHeight"
// and extract lines or context.
const searchKeywords = ['resize', 'flexBasis', 'flex-basis', 'orientation', 'portrait', 'landscape', 'graphPanel'];

searchKeywords.forEach(keyword => {
  console.log(`=== Matches for: ${keyword} ===`);
  let idx = 0;
  while (true) {
    idx = content.indexOf(keyword, idx);
    if (idx === -1) break;
    const start = Math.max(0, idx - 100);
    const end = Math.min(content.length, idx + 100);
    const snippet = content.substring(start, end).replace(/\r?\n/g, ' ');
    console.log(`[Pos ${idx}] ... ${snippet} ...`);
    idx += keyword.length;
  }
});
