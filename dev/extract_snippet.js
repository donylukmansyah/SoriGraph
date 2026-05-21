const fs = require('fs');
const panelJsPath = 'C:\\Users\\Minguri\\Downloads\\free plugin\\free plugin\\Flow v1.5.2\\Flow v1.5.2\\panel\\js\\panel.js';
const content = fs.readFileSync(panelJsPath, 'utf8');

const pos = 572272;
const start = Math.max(0, pos - 400);
const end = Math.min(content.length, pos + 400);
console.log(content.substring(start, end));
