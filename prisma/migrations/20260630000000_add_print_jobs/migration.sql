-- CreateTable
CREATE TABLE "PrintJob" (
    "id" TEXT NOT NULL,
    "order_number" TEXT NOT NULL,
    "load_number" INTEGER NOT NULL,
    "number_of_loads" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrintJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PrintJob_status_created_at_idx" ON "PrintJob"("status", "created_at");
