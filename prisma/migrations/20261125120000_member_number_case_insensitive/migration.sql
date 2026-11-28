-- The frontend treats member numbers as case-insensitive (CS/001 = cs/001).
-- Prisma can't express an expression index in schema.prisma, so this is SQL-only,
-- like the partial unique indexes from the earlier migrations.
CREATE UNIQUE INDEX "members_club_id_lower_member_number_key"
  ON "members" ("club_id", lower("member_number"));