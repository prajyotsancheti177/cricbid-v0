-- Host-side settings for the player sheet: visible columns and the labels of
-- the host's own note columns. Nullable; absent means "use the defaults".
ALTER TABLE "tournament" ADD COLUMN "playerSheetConfig" JSONB;
