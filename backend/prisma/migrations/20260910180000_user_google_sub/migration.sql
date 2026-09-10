-- Google sign-in for tournament hosts and admins.
--
-- Unlike a player account, a host is never created by signing in: a Google
-- account is MATCHED to a user an administrator already created. Otherwise
-- anyone with a Google account could sign in and be handed a host role.
--
-- The match is on the verified Google email. `googleSub` is recorded on first
-- use so the link survives an email change later, and so a second Google
-- account can never quietly attach to the same host.
ALTER TABLE "user" ADD COLUMN "googleSub" TEXT;
CREATE UNIQUE INDEX "user_googleSub_key" ON "user"("googleSub");
