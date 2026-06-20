import { PrismaClient } from "@prisma/client";

let _client: PrismaClient | null = null;

function getClient() {
  if (!_client) {
    _client = new PrismaClient({
      datasources: { db: { url: process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL } },
    });
  }
  return _client;
}

export async function getTestOrderBySeq(seq: number) {
  const today = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const prefix = `ORDER-${today.getFullYear()}${pad(today.getMonth() + 1)}${pad(today.getDate())}`;
  const orderNumber = `${prefix}-${String(seq).padStart(4, "0")}`;
  return getClient().order.findFirst({ where: { orderNumber } });
}

export async function disconnect() {
  if (_client) {
    await _client.$disconnect();
    _client = null;
  }
}
