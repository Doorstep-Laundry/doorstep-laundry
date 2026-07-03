ALTER TABLE "AppRelease" ADD COLUMN "env" TEXT NOT NULL DEFAULT 'prod';
CREATE INDEX "AppRelease_env_uploaded_at_idx" ON "AppRelease"("env", "uploaded_at");
