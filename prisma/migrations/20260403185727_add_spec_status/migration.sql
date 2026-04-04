-- CreateEnum
CREATE TYPE "SpecStatus" AS ENUM ('FORMED', 'ISSUED', 'PENDING', 'PAID');

-- AlterTable
ALTER TABLE "Specification" ADD COLUMN     "status" "SpecStatus" NOT NULL DEFAULT 'FORMED';
