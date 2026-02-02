// Create QAerx logo icons - Navy blue circle with emerald green checkmark
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// QAerx logo SVG - Navy blue circle with emerald green checkmark
const createLogoSvg = (size) => `
<svg width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <!-- Navy blue background circle -->
  <circle cx="50" cy="50" r="45" fill="#2d3a6d"/>

  <!-- Emerald green checkmark -->
  <path d="M30 50 L45 65 L70 35"
        stroke="#10b981"
        stroke-width="${size > 32 ? 8 : 6}"
        stroke-linecap="round"
        stroke-linejoin="round"
        fill="none"/>
</svg>
`;

// Create directories
const distIconsDir = path.join(__dirname, '..', 'dist', 'icons');
const publicIconsDir = path.join(__dirname, '..', 'public', 'icons');

[distIconsDir, publicIconsDir].forEach(dir => {
  fs.mkdirSync(dir, { recursive: true });
});

// Icon sizes to generate
const sizes = [16, 32, 48, 128];

async function createIcons() {
  for (const size of sizes) {
    const svgBuffer = Buffer.from(createLogoSvg(size));

    // Generate PNG from SVG
    const pngBuffer = await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toBuffer();

    // Write to both directories
    const distPath = path.join(distIconsDir, `icon-${size}.png`);
    const publicPath = path.join(publicIconsDir, `icon-${size}.png`);

    fs.writeFileSync(distPath, pngBuffer);
    fs.writeFileSync(publicPath, pngBuffer);

    console.log(`Created icon-${size}.png`);
  }

  console.log('QAerx icons created successfully!');
}

createIcons().catch(err => {
  console.error('Error creating icons:', err);
  process.exit(1);
});
