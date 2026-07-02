CREATE TABLE "app_release" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "version_code" INTEGER NOT NULL,
    "file_name" TEXT NOT NULL,
    "blob_url" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "notes" TEXT,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploaded_by" TEXT NOT NULL,

    CONSTRAINT "app_release_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "app_release_uploaded_at_idx" ON "app_release"("uploaded_at");
