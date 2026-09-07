-- Players must have their payment verified before they enter the auction.
ALTER TABLE "player" ADD COLUMN "paymentVerified" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: everything that already exists is treated as verified, so no live
-- auction loses its squad the moment this ships. The one exception is the Jain
-- Unity Cup, which is still taking registrations and will be verified by hand.
-- (Id is production-specific; on any other database the second statement is a
-- no-op and everything is simply marked verified.)
UPDATE "player" SET "paymentVerified" = true;
UPDATE "player" SET "paymentVerified" = false WHERE "touranmentId" = 'cmtmuj9wa03sqp8pin6pg1v6q';
