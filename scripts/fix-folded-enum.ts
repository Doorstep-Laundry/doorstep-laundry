/**
 * One-time migration: rename LoadStatus enum value 'folded' → 'folding' in the DB.
 *
 * Run BEFORE `npx prisma db push` when the schema has 'folding' but the DB still has 'folded'.
 *
 *   npx tsx scripts/fix-folded-enum.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient();
  try {
    // Add 'folding' to the existing enum so we can migrate rows to it.
    await prisma.$executeRaw`ALTER TYPE "LoadStatus" ADD VALUE IF NOT EXISTS 'folding'`;
    console.log("Added 'folding' to LoadStatus enum.");

    // Update any rows still using the old 'folded' value.
    const updated = await prisma.$executeRaw`
      UPDATE "OrderLoad" SET status = 'folding' WHERE status::text = 'folded'
    `;
    console.log(`Updated ${updated} row(s) from 'folded' → 'folding'.`);

    console.log("\nDone. Now run: npx prisma db push --accept-data-loss");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
