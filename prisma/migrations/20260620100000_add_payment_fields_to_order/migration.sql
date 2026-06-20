-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'ready_for_payment', 'paid', 'waived', 'credited');

-- AlterTable
ALTER TABLE "Order"
  ADD COLUMN "premium_surcharge_per_pound_cents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "payment_waived" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "payment_status" "PaymentStatus" NOT NULL DEFAULT 'pending';
