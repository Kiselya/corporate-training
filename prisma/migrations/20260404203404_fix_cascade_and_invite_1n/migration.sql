/*
  Warnings:

  - You are about to drop the column `usedById` on the `InviteLink` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "GroupMember" DROP CONSTRAINT "GroupMember_employeeId_fkey";

-- DropForeignKey
ALTER TABLE "InviteLink" DROP CONSTRAINT "InviteLink_usedById_fkey";

-- DropIndex
DROP INDEX "InviteLink_usedById_key";

-- AlterTable
ALTER TABLE "InviteLink" DROP COLUMN "usedById";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "inviteLinkId" TEXT;

-- AddForeignKey
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_inviteLinkId_fkey" FOREIGN KEY ("inviteLinkId") REFERENCES "InviteLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;
