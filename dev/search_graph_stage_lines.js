const fs = require('fs');
const stylesPath = 'panel/css/styles.css';
const content = fs.readFileSync(stylesPath, 'utf8');

const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('.graph-stage') || line.includes('graph-stage')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
