// Create simple solid color PNG icons
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Pre-generated base64 icon (16x16 green square)
const icon16Base64 = 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAKklEQVR42mNgGFTg/4cP/6kCAQZqvkDtF9D0BepfQNMX0PQFw8kLDFQCAChfKp8NKcO3AAAAAElFTkSuQmCC';

// Create directories
const distIconsDir = path.join(__dirname, '..', 'dist', 'icons');
const publicIconsDir = path.join(__dirname, '..', 'public', 'icons');

[distIconsDir, publicIconsDir].forEach(dir => {
  fs.mkdirSync(dir, { recursive: true });
});

// Create icons (all same for now - placeholder)
const iconData = Buffer.from(icon16Base64, 'base64');
const sizes = [16, 32, 48, 128];

sizes.forEach(size => {
  const distPath = path.join(distIconsDir, 'icon-' + size + '.png');
  const publicPath = path.join(publicIconsDir, 'icon-' + size + '.png');
  fs.writeFileSync(distPath, iconData);
  fs.writeFileSync(publicPath, iconData);
  console.log('Created icon-' + size + '.png');
});

console.log('Done!');
