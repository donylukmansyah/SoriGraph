const fs = require('fs');
const panelJsPath = 'C:\\Users\\Minguri\\Downloads\\free plugin\\free plugin\\Flow v1.5.2\\Flow v1.5.2\\panel\\js\\panel.js';
const content = fs.readFileSync(panelJsPath, 'utf8');

// Find all matches for setting element styles with "preset"
const regex = /preset[^.]*\.style\.width/g;
let match;
while ((match = regex.exec(content)) !== null) {
  const idx = match.index;
  console.log(`[Pos ${idx}] ... ${content.substring(idx - 100, idx + 100)} ...`);
}

// Search for "presetSize" or similar constants
const keywords = ['presetWidth', 'presetSize', 'cardWidth', 'cardSize'];
keywords.forEach(keyword => {
  let idx = 0;
  while ((idx = content.indexOf(keyword, idx)) !== -1) {
    console.log(`Keyword match for ${keyword} at ${idx}: ... ${content.substring(idx - 100, idx + 100)} ...`);
    idx += keyword.length;
  }
});
