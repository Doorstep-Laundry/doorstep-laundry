-- CreateEnum
CREATE TYPE "CustomerType" AS ENUM ('young_professional', 'busy_family', 'mobility_limited', 'business', 'not_set');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "customer_type" "CustomerType" NOT NULL DEFAULT 'not_set';
