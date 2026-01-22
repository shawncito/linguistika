export const formatCRC = (value: number) =>
  new Intl.NumberFormat('es-CR', {
    style: 'currency',
    currency: 'CRC',
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

export const formatDateCR = (value: string | number | Date) =>
  new Date(value).toLocaleDateString('es-CR', { year: 'numeric', month: 'short', day: '2-digit' });
