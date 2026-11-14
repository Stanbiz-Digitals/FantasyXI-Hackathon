-- CreateEnum
CREATE TYPE "TeamVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- AlterTable
ALTER TABLE "leagues" ADD COLUMN "team_visibility" "TeamVisibility" NOT NULL DEFAULT 'PUBLIC';
