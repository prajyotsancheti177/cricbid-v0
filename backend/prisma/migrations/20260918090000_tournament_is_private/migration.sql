-- A private tournament is hidden from every public list and read endpoint, and
-- from admins who were not explicitly given access.
ALTER TABLE "tournament" ADD COLUMN "isPrivate" BOOLEAN NOT NULL DEFAULT false;
