DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'app_release') THEN
    ALTER TABLE "app_release" RENAME TO "AppRelease";
    ALTER INDEX "app_release_uploaded_at_idx" RENAME TO "AppRelease_uploaded_at_idx";
    ALTER TABLE "AppRelease" RENAME CONSTRAINT "app_release_pkey" TO "AppRelease_pkey";
  END IF;
END $$;
