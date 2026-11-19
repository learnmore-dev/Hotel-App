-- AlterTable
ALTER TABLE "Booking" ADD COLUMN "idempotencyKey" VARCHAR(128);

-- CreateIndex
CREATE UNIQUE INDEX "Booking_idempotencyKey_key" ON "Booking"("idempotencyKey");
