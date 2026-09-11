-- One session per device, instead of one per person.
--
-- `user.sessionToken` was a single UNIQUE column, so signing in anywhere
-- overwrote the token everywhere else: a laptop and a phone could not both be
-- signed in, and whichever device was not last to log in got told its session
-- had expired, over and over. That is a schema problem, not a timeout problem.
--
-- A session is now a row. Signing in adds one; signing out removes one; the
-- others are untouched.

CREATE TABLE "user_session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    -- Enough to tell one device from another in a "signed in on" list, without
    -- storing anything more identifying than the browser already announces.
    "userAgent" TEXT,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_session_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_session_token_key" ON "user_session"("token");
CREATE INDEX "user_session_userId_idx" ON "user_session"("userId");
CREATE INDEX "user_session_expiresAt_idx" ON "user_session"("expiresAt");

ALTER TABLE "user_session" ADD CONSTRAINT "user_session_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Carry any live session across so nobody is signed out by this migration.
INSERT INTO "user_session" ("id", "userId", "token", "expiresAt", "createdAt", "lastSeenAt")
SELECT
    md5(random()::text || clock_timestamp()::text),
    "id",
    "sessionToken",
    COALESCE("sessionExpiresAt", CURRENT_TIMESTAMP + INTERVAL '90 days'),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "user"
WHERE "sessionToken" IS NOT NULL;

ALTER TABLE "user" DROP COLUMN "sessionToken";
ALTER TABLE "user" DROP COLUMN "sessionExpiresAt";
