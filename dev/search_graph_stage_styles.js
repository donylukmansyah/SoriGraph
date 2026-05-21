const fs = require('fs');
const stylesPath = 'panel/css/styles.css';
const content = fs.readFileSync(stylesPath, 'utf8');

// Find all matches for .graph-stage
const regex = /\.graph-stage/g;
let match;
while ((match = regex.exec(content)) !== null) {
  const idx = match.index;
  console.log(`[Pos ${idx}] ... ${content.substring(idx - 100, idx + 100).replace(/\r?\n/g, ' ')} ...`);
}
