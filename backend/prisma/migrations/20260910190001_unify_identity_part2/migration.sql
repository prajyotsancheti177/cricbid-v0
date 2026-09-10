-- Part two of the identity merge. Split from the enum change because Postgres
-- will not let a new enum value be USED in the same transaction that adds it.

ALTER TABLE "user" ALTER COLUMN "role" SET DEFAULT 'player';

-- A Google-only user has no password. The 12 existing admins keep theirs, so
-- both ways in keep working.
ALTER TABLE "user" ALTER COLUMN "password" DROP NOT NULL;

-- Sessions, so a player signed in with Google is recognised on return. Admins
-- still use the older localStorage flow; this is what will replace it.
ALTER TABLE "user" ADD COLUMN "sessionToken" TEXT;
ALTER TABLE "user" ADD COLUMN "sessionExpiresAt" TIMESTAMP(3);
ALTER TABLE "user" ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX "user_sessionToken_key" ON "user"("sessionToken");

-- Players now hang off a user rather than a separate account. No row had an
-- accountId, so nothing is lost by repointing rather than migrating.
ALTER TABLE "player_profile" DROP CONSTRAINT IF EXISTS "player_profile_accountId_fkey";
DROP INDEX IF EXISTS "player_profile_accountId_idx";
ALTER TABLE "player_profile" DROP COLUMN "accountId";
ALTER TABLE "player_profile" ADD COLUMN "userId" TEXT;
ALTER TABLE "player_profile" ADD CONSTRAINT "player_profile_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "player_profile_userId_idx" ON "player_profile"("userId");

DROP TABLE "player_account";

-- Which tournaments a granted host may work on, on top of any they own.
-- Ownership still lives on tournament.tournamentHostId; this is additive, so
-- no current host loses the tournaments they created.
CREATE TABLE "tournament_access" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    -- who granted it, for an audit trail worth having on a permissions table
    "grantedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tournament_access_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tournament_access_userId_tournamentId_key" ON "tournament_access"("userId", "tournamentId");
CREATE INDEX "tournament_access_tournamentId_idx" ON "tournament_access"("tournamentId");

ALTER TABLE "tournament_access" ADD CONSTRAINT "tournament_access_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tournament_access" ADD CONSTRAINT "tournament_access_tournamentId_fkey"
    FOREIGN KEY ("tournamentId") REFERENCES "tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tournament_access" ADD CONSTRAINT "tournament_access_grantedById_fkey"
    FOREIGN KEY ("grantedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Name search on the user list, which is about to hold every player who signs in.
CREATE INDEX "user_name_idx" ON "user"("name");
