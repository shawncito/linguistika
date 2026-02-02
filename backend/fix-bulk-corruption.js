import fs from 'fs';
import path from 'path';

const target = path.resolve(process.cwd(), 'backend', 'routes', 'bulk.js');

const original = fs.readFileSync(target, 'utf8');

// Replace the corrupted wsListas.addRow line that may contain stray characters after "grados[i] ?? ''"
// We match with a tolerant pattern, allowing optional chaining and arbitrary whitespace.
const re = /wsListas\.addRow\(\[\s*cursos\[i\]\?\.nombre\s*\?\?\s*''\s*,\s*tutores\[i\]\?\.nombre\s*\?\?\s*''\s*,\s*turnos\[i\]\s*\?\?\s*''\s*,\s*grados\[i\]\s*\?\?\s*''[\s\S]*?\]\);/g;

const replacement = "wsListas.addRow([cursos[i]?.nombre ?? '', tutores[i]?.nombre ?? '', turnos[i] ?? '', grados[i] ?? '']);";

const fixed = original.replace(re, replacement);

if (fixed === original) {
  console.error('No match found; file may already be fixed or pattern changed.');
  process.exit(1);
}

fs.writeFileSync(target, fixed, 'utf8');
console.log('bulk.js: corrupted wsListas.addRow line fixed');
