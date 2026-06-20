-- Add missing LoadStatus values that were added to schema.prisma without a migration
ALTER TYPE "LoadStatus" ADD VALUE IF NOT EXISTS 'scheduled';
ALTER TYPE "LoadStatus" ADD VALUE IF NOT EXISTS 'picked_up';
