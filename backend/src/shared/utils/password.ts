import bcrypt from "bcryptjs";

/**
 * Password hashing.
 *
 * Uses bcrypt via the pure-JS `bcryptjs` implementation: no native build step,
 * which keeps the Alpine image small and the 2 vCPU target box happy. Cost 10 is
 * a reasonable trade-off for a training platform; raise it if the host allows.
 */
const COST = 10;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}
