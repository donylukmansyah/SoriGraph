const fs = require('fs');
const panelJsPath = 'C:\\Users\\Minguri\\Downloads\\free plugin\\free plugin\\Flow v1.5.2\\Flow v1.5.2\\panel\\js\\panel.js';
const content = fs.readFileSync(panelJsPath, 'utf8');

const pos = 893300;
const start = Math.max(0, pos - 200);
const end = Math.min(content.length, pos + 1000);
console.log(content.substring(start, end));
