import "dotenv/config";
import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { debugLog } from "@/lib/debug";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pool: Pool | undefined;
};

const pool =
  globalForPrisma.pool ??
  new Pool({
    connectionString: process.env.DATABASE_URL || process.env.DIRECT_URL,
    max: Number(process.env.DB_POOL_MAX || 10),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

if (!globalForPrisma.pool) {
  pool.on("error", (err) => {
    console.error("Unexpected error on idle pg client in Pawnify", err);
  });
  globalForPrisma.pool = pool;
}

const adapter = new PrismaPg(pool);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
  });

if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = prisma;
}

/**
 * Two concurrent transactions reading and writing the same loan (e.g. two
 * simultaneous payments) can otherwise both read a stale balance under
 * Postgres's default Read Committed isolation and silently lose one update.
 * Serializable isolation makes Postgres detect that conflict and abort one
 * transaction with a serialization failure (P2034) instead of corrupting
 * the balance — we retry a few times since that failure is expected/transient.
 */
export async function runSerializable<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  maxAttempts = 3
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await prisma.$transaction(fn, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (err) {
      const isSerializationFailure =
        err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2034";
      if (!isSerializationFailure || attempt === maxAttempts) {
        throw err;
      }
      debugLog("db", `Serialization conflict, retrying (attempt ${attempt}/${maxAttempts})`);
    }
  }
  throw new Error("unreachable");
}
