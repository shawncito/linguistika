const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const date = new Date('2026-01-26T00:00:00');
console.log('Fecha:', '2026-01-26');
console.log('getDay():', date.getDay());
console.log('Día:', dias[date.getDay()]);

// Verificar todo enero 2026
console.log('\n=== Enero 2026 ===');
for (let day = 1; day <= 31; day++) {
  const dateStr = `2026-01-${String(day).padStart(2, '0')}`;
  const d = new Date(dateStr + 'T00:00:00');
  console.log(`${dateStr}: ${dias[d.getDay()]}`);
}
