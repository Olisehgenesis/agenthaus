import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import path from "path";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function getDatabaseUrl(): string {
  const envUrl = process.env.DATABASE_URL;
  // If the env var is a relative file: URL, resolve it to an absolute path
  if (envUrl && envUrl.startsWith("file:")) {
    const filePath = envUrl.replace("file:", "").replace("./", "");
    return `file:${path.join(process.cwd(), filePath)}`;
  }
  // Fallback: absolute path to dev.db in project root
  return `file:${path.join(process.cwd(), "dev.db")}`;
}

function createPrismaClient() {
  const adapter = new PrismaLibSql({
    url: getDatabaseUrl(),
  });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
