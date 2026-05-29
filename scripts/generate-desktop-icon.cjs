const fs = require('node:fs');
const path = require('node:path');
const pngToIcoModule = require('png-to-ico');
const pngToIco = pngToIcoModule.default ?? pngToIcoModule;

const rootDir = path.resolve(__dirname, '..');
const publicDir = path.join(rootDir, 'public');
const buildDir = path.join(rootDir, 'build');
const outputPath = path.join(buildDir, 'icon.ico');
const sourceIconFiles = [
  'icon-512.png',
  'icon-1024.png',
  'icon-192.png'
];

async function generateIcon() {
  const source = sourceIconFiles
    .map((fileName) => path.join(publicDir, fileName))
    .find((filePath) => fs.existsSync(filePath));

  if (!source) {
    throw new Error('No high-resolution PNG app icon was found in public/.');
  }

  fs.mkdirSync(buildDir, { recursive: true });
  const iconBuffer = await pngToIco(source);
  fs.writeFileSync(outputPath, iconBuffer);
  console.log(`Generated ${path.relative(rootDir, outputPath)}`);
}

generateIcon().catch((error) => {
  console.error(error);
  process.exit(1);
});