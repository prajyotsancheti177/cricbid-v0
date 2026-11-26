-- Role visibility overrides: a boss's changes to which roles see a page,
-- workspace tab or action. Additive; only differences from the defaults in
-- shared/visibility-manifest.json are stored, so an empty table means
-- "everything as before".
CREATE TABLE "role_visibility" (
    "role" "Role" NOT NULL,
    "resourceKey" TEXT NOT NULL,
    "visible" BOOLEAN NOT NULL,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "role_visibility_pkey" PRIMARY KEY ("role","resourceKey")
);
