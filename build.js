const fs = require('fs');
const path = require('path');

const required = [
  'server.js', 'package.json', 'public/index.html',
  'public/styles.css', 'public/app.js', 'public/assets/logo.svg',
  'public/assets/table.svg', 'public/assets/favicon.svg'
];

for (const file of required) {
  if (!fs.existsSync(path.join(process.cwd(), file))) {
    throw new Error(`Missing required file: ${file}`);
  }
}
console.log(`Build check passed: ${required.length} files present.`);
