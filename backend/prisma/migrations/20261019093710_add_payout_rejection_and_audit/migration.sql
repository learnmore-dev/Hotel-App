-- AlterEnum
ALTER TYPE "PayoutStatus" ADD VALUE 'REJECTED';

-- AlterTable
ALTER TABLE "Payout" ADD COLUMN     "batchReference" VARCHAR(160),
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "processedBy" UUID,
ADD COLUMN     "rejectionReason" TEXT;

-- CreateIndex
CREATE INDEX "Payout_batchReference_idx" ON "Payout"("batchReference");
