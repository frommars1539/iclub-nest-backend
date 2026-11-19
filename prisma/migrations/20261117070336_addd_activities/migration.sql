-- CreateEnum
CREATE TYPE "ActivityStatus" AS ENUM ('SCHEDULED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'EXCUSED');

-- CreateTable
CREATE TABLE "activities" (
    "id" TEXT NOT NULL,
    "club_id" TEXT NOT NULL,
    "unit_id" TEXT,
    "name" TEXT NOT NULL,
    "type_label" TEXT,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "status" "ActivityStatus" NOT NULL DEFAULT 'SCHEDULED',
    "cancel_reason" TEXT,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_marks" (
    "id" TEXT NOT NULL,
    "activity_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "marked_by" TEXT NOT NULL,
    "marked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_marks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_events" (
    "id" TEXT NOT NULL,
    "activity_id" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "activities_club_id_starts_at_idx" ON "activities"("club_id", "starts_at");

-- CreateIndex
CREATE INDEX "attendance_marks_member_id_idx" ON "attendance_marks"("member_id");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_marks_activity_id_member_id_key" ON "attendance_marks"("activity_id", "member_id");

-- CreateIndex
CREATE INDEX "activity_events_activity_id_idx" ON "activity_events"("activity_id");

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_marks" ADD CONSTRAINT "attendance_marks_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_marks" ADD CONSTRAINT "attendance_marks_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_marks" ADD CONSTRAINT "attendance_marks_marked_by_fkey" FOREIGN KEY ("marked_by") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AC-030.3: an activity cannot end before it starts.
ALTER TABLE "activities"
  ADD CONSTRAINT "activities_end_after_start" CHECK ("ends_at" >= "starts_at");

-- History logs are append-only. forbid_mutation() was created in add_access_audit.
CREATE TRIGGER activity_events_append_only
  BEFORE UPDATE OR DELETE ON "activity_events"
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

-- FR-015 / AC-015.2: membership history is never amended or deleted.
CREATE TRIGGER member_events_append_only
  BEFORE UPDATE OR DELETE ON "member_events"
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
