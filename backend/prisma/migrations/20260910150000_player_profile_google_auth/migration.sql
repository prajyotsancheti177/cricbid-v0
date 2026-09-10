-- Google sign-in for player profiles.
--
-- Phone stays the identity key of this system — hosts message players on
-- WhatsApp and registrations are matched by mobile — so Google is a front door
-- onto a phone-keyed profile, not a second identity space.
--
-- A Google sign-in never claims one of the profiles auto-created from public
-- registrations: those rows have no owner, and letting someone inherit one by
-- typing a phone number would hand them another player's name, photo and
-- address. New users start from scratch.
--
-- That is also why the typed number lands in `pendingMobile` rather than
-- `mobile`: `mobile` is UNIQUE, and a number an existing shell already holds
-- would either collide or force a merge. `pendingMobile` is unverified and
-- deliberately not unique; OTP promotes it to `mobile` later.

-- `mobile` becomes nullable so a Google profile can exist before its number is
-- verified. Every existing row keeps its value, and UNIQUE still holds because
-- Postgres allows many NULLs.
ALTER TABLE "player_profile" ALTER COLUMN "mobile" DROP NOT NULL;

ALTER TABLE "player_profile" ADD COLUMN "googleSub" TEXT;
ALTER TABLE "player_profile" ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "player_profile" ADD COLUMN "pendingMobile" TEXT;
ALTER TABLE "player_profile" ADD COLUMN "mobileVerified" BOOLEAN NOT NULL DEFAULT false;
-- Sessions never expired. One token per profile, valid forever, is not a
-- session — give it an end.
ALTER TABLE "player_profile" ADD COLUMN "sessionExpiresAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "player_profile_googleSub_key" ON "player_profile"("googleSub");
CREATE INDEX "player_profile_email_idx" ON "player_profile"("email");
CREATE INDEX "player_profile_pendingMobile_idx" ON "player_profile"("pendingMobile");

-- Every mobile currently in the table arrived from a registration form and was
-- never verified by us. Saying so explicitly beats implying otherwise.
UPDATE "player_profile" SET "mobileVerified" = false;
