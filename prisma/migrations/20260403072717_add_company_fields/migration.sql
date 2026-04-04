-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "address" TEXT,
ADD COLUMN     "contactPerson" TEXT,
ADD COLUMN     "customFields" JSONB DEFAULT '{}',
ADD COLUMN     "email" TEXT,
ADD COLUMN     "inn" TEXT,
ADD COLUMN     "kpp" TEXT,
ADD COLUMN     "ogrn" TEXT,
ADD COLUMN     "phone" TEXT;
