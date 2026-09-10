-- Split login from player.
--
-- A profile used to be both "who is signed in" and "who is playing". Those are
-- not the same thing: a parent signs in once and registers two children, so one
-- login owns several players. `player_account` is now the identity and
-- `player_profile` is purely a player.
--
-- That is also why mobile stops being unique on a profile. Both children carry
-- the parent's number, and a UNIQUE constraint made that impossible to record.
-- The number a login is PROVED to own lives on the account instead, set only by
-- OTP later; a profile's mobile is contact information, not identity.
--
-- Passwords are gone. Of 570 profiles only 2 ever had one — the other 568 were
-- auto-created during public registration with no password at all, so the login
-- form told people their profile existed and then refused to let them in.
-- Google sign-in replaces it, WhatsApp OTP will join it.
--
-- Snapshot taken before this ran:
--   backups/player_profile_pre_account_split_2026-09-10T14-16-47-724Z.json

CREATE TABLE "player_account" (
    "id" TEXT NOT NULL,
    -- Google identity. Null on an account created by OTP.
    "googleSub" TEXT,
    "email" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    -- The number this login has PROVED it owns. Only OTP may write it, which is
    -- why it is still unique: one verified number, one login.
    "mobile" TEXT,
    "mobileVerified" BOOLEAN NOT NULL DEFAULT false,
    "sessionToken" TEXT,
    "sessionExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "player_account_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "player_account_googleSub_key" ON "player_account"("googleSub");
CREATE UNIQUE INDEX "player_account_mobile_key" ON "player_account"("mobile");
CREATE UNIQUE INDEX "player_account_sessionToken_key" ON "player_account"("sessionToken");
CREATE INDEX "player_account_email_idx" ON "player_account"("email");

-- A profile with no account is one of the 568 shells auto-created from a public
-- registration. Nobody owns those; they are left unclaimed on purpose rather
-- than handed to whoever signs in with a matching email or number.
ALTER TABLE "player_profile" ADD COLUMN "accountId" TEXT;

ALTER TABLE "player_profile" ADD CONSTRAINT "player_profile_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "player_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "player_profile_accountId_idx" ON "player_profile"("accountId");

-- Two siblings share a parent's number, so this can no longer be unique.
DROP INDEX IF EXISTS "player_profile_mobile_key";
CREATE INDEX "player_profile_mobile_idx" ON "player_profile"("mobile");

-- Identity columns move to the account. Dropping these ends the 2 password
-- logins and their sessions; both are in the snapshot above.
ALTER TABLE "player_profile" DROP COLUMN "password";
ALTER TABLE "player_profile" DROP COLUMN "sessionToken";
ALTER TABLE "player_profile" DROP COLUMN "sessionExpiresAt";
ALTER TABLE "player_profile" DROP COLUMN "googleSub";
ALTER TABLE "player_profile" DROP COLUMN "emailVerified";
ALTER TABLE "player_profile" DROP COLUMN "mobileVerified";
-- Added yesterday to dodge the UNIQUE on mobile. With that gone it has no job,
-- and it never held a row.
ALTER TABLE "player_profile" DROP COLUMN "pendingMobile";
