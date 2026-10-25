const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const www = path.join(root, 'www');

fs.mkdirSync(www, { recursive: true });

for (const file of ['index.html', 'register.html', 'app.js', 'register.js', 'style.css', 'manifest.json', 'sw.js', 'CNAME']) {
  const src = path.join(root, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(www, file));
  }
}

for (const dir of ['icons', 'js']) {
  const srcDir = path.join(root, dir);
  if (fs.existsSync(srcDir)) {
    fs.cpSync(srcDir, path.join(www, dir), { recursive: true });
  }
}

console.log('Copied web assets, icons, and js modules to www/');
