import { PrismaClient } from "@prisma/client";

// Satu instance PrismaClient saja (hindari koneksi menumpuk saat hot-reload di dev).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
