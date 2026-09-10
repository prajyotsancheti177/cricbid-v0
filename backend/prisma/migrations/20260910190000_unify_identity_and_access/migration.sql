-- One identity, role decides access.
--
-- There were two login tables: `user` (12 admins with passwords) and
-- `player_account` (Google, built the day before and still empty). The model
-- this replaces them with is simpler: everyone signs in with Google, everyone
-- starts as a `player`, and a boss promotes them from there.
--
-- `player_account` had 0 rows, so this merge costs nothing today. It would not
-- have stayed free once players started signing in.
--
-- Snapshot before this ran:
--   backups/identity_pre_user_merge_2026-09-10T17-39-34-057Z.json

-- `player` is the new default. Everyone who signs in is one until promoted.
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'player';
