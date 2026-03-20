import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | null | undefined;
  prismaInitError: Error | null | undefined;
};

function createPrismaClient(): PrismaClient | null {
  try {
    return new PrismaClient({
      log: ["error"]
    });
  } catch (error) {
    const normalizedError =
      error instanceof Error ? error : new Error("Unknown Prisma initialization error");
    globalForPrisma.prismaInitError = normalizedError;
    console.error("[prisma] initialization failed:", normalizedError.message);
    return null;
  }
}

export function getPrismaClientSafe(): PrismaClient | null {
  if (globalForPrisma.prisma === undefined) {
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma ?? null;
}

export function getPrismaInitErrorMessage(): string | null {
  return globalForPrisma.prismaInitError?.message ?? null;
}

export const prisma = getPrismaClientSafe();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
