ALTER TABLE "app_release" RENAME TO "AppRelease";
ALTER INDEX "app_release_uploaded_at_idx" RENAME TO "AppRelease_uploaded_at_idx";
ALTER TABLE "AppRelease" RENAME CONSTRAINT "app_release_pkey" TO "AppRelease_pkey";
