const fs = require('fs');
const path = require('path');

async function main() {
  const sharp = require('sharp');
  const pngToIco = require('png-to-ico');

  const root = path.join(__dirname, '..');
  const pngSourcePath = process.env.LOGO_SOURCE
    ? path.resolve(process.env.LOGO_SOURCE)
    : path.join(root, 'desktop', 'logo-source.png');
  const svgPath = path.join(root, 'public', 'logo-icon.svg');
  const outDir = path.join(root, 'desktop');
  const outPng = path.join(outDir, 'icon.png');
  const outIco = path.join(outDir, 'icon.ico');

  const webFaviconPng = path.join(root, 'LInguistika-Studio', 'public', 'favicon.png');
  const webFaviconIco = path.join(root, 'LInguistika-Studio', 'public', 'favicon.ico');

  const hasPng = fs.existsSync(pngSourcePath);
  const hasSvg = fs.existsSync(svgPath);
  if (!hasPng && !hasSvg) {
    throw new Error(
      `No se encontró un logo de origen.\n- PNG esperado: ${pngSourcePath}\n- SVG esperado: ${svgPath}`
    );
  }
  fs.mkdirSync(outDir, { recursive: true });

  // Render 512px para buena calidad, luego se reutiliza para ICO.
  const input = hasPng ? pngSourcePath : svgPath;
  const pipeline = hasPng
    ? sharp(input)
    : sharp(input, { density: 512 });

  const pngBuffer = await pipeline
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  fs.writeFileSync(outPng, pngBuffer);

  const icoBuffer = await pngToIco(pngBuffer);
  fs.writeFileSync(outIco, icoBuffer);

  // Favicons web
  const faviconPngBuffer = await sharp(pngBuffer).resize(256, 256).png().toBuffer();
  fs.writeFileSync(webFaviconPng, faviconPngBuffer);
  const faviconIcoBuffer = await pngToIco(await sharp(pngBuffer).resize(256, 256).png().toBuffer());
  fs.writeFileSync(webFaviconIco, faviconIcoBuffer);

  console.log('✅ Íconos generados:');
  console.log(' -', outPng);
  console.log(' -', outIco);
  console.log('✅ Favicons web generados:');
  console.log(' -', webFaviconPng);
  console.log(' -', webFaviconIco);
}

main().catch((err) => {
  console.error('❌ Error generando íconos:', err);
  process.exit(1);
});
