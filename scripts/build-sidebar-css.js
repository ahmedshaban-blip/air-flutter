const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const sourceDirectory = path.join(projectRoot, 'media', 'css', 'sidebar');
const outputPath = path.join(projectRoot, 'media', 'sidebar.css');
const modules = [
  'base.css',
  'device-card.css',
  'bridge.css',
  'tools.css',
  'logcat.css',
  'wipe.css'
];

const bundledCss = modules.map(fileName => {
  const source = fs.readFileSync(path.join(sourceDirectory, fileName), 'utf8').trimEnd();
  return `/* --- media/css/sidebar/${fileName} --- */\n${source}`;
}).join('\n\n');

fs.writeFileSync(outputPath, `${bundledCss}\n`);
console.log(`Built ${path.relative(projectRoot, outputPath)} from ${modules.length} modules.`);
