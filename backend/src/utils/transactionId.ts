import crypto from 'node:crypto';

/**
 * Generates human-readable transaction reference matching TXN-YYYYMMDD-XXXXXX format.
 */
export function generateTransactionId(prefix = 'TXN', date: Date = new Date()): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const dateStr = `${yyyy}${mm}${dd}`;
  const randomSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${prefix}-${dateStr}-${randomSuffix}`;
}
