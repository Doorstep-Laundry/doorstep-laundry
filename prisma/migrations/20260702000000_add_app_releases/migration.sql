CREATE TABLE "AppRelease" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "version_code" INTEGER NOT NULL,
    "file_name" TEXT NOT NULL,
    "blob_url" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "notes" TEXT,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploaded_by" TEXT NOT NULL,

    CONSTRAINT "AppRelease_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AppRelease_uploaded_at_idx" ON "AppRelease"("uploaded_at");
