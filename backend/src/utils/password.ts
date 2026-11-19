import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  if (bcrypt.truncates(password)) {
    throw new Error('Password exceeds the supported bcrypt input length');
  }
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(password: string, passwordHash: string): Promise<boolean> {
  if (bcrypt.truncates(password)) return false;
  return bcrypt.compare(password, passwordHash);
}
