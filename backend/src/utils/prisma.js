import { PrismaClient } from '@prisma/client';

// Single shared Prisma instance — every module imports this,
// never instantiates its own PrismaClient.
export const prisma = new PrismaClient();
