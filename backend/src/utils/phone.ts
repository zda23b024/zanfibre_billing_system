export function normalizeTanzanianPhone(input: string): string | null {
  const raw = String(input || '').trim().replace(/[\s().-]/g, '');
  if (!raw) return null;

  let digits = raw.startsWith('+') ? raw.slice(1) : raw;
  if (!/^\d+$/.test(digits)) return null;

  if (digits.startsWith('255') && digits.length === 12) {
    return `+${digits}`;
  }
  if (digits.startsWith('0') && digits.length === 10) {
    return `+255${digits.slice(1)}`;
  }
  if (digits.length === 9) {
    return `+255${digits}`;
  }
  return null;
}
