/*
  Warnings:

  - You are about to drop the column `type_label` on the `activities` table. All the data in the column will be lost.
  - Added the required column `responsible_position_id` to the `activities` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "activities" DROP COLUMN "type_label",
ADD COLUMN     "responsible_position_id" TEXT NOT NULL,
ADD COLUMN     "type_id" TEXT;

-- CreateTable
CREATE TABLE "activity_types" (
    "id" TEXT NOT NULL,
    "club_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "activity_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_amendments" (
    "id" TEXT NOT NULL,
    "mark_id" TEXT NOT NULL,
    "previous_status" "AttendanceStatus" NOT NULL,
    "new_status" "AttendanceStatus" NOT NULL,
    "amended_by" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_amendments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "activity_types_club_id_name_key" ON "activity_types"("club_id", "name");

-- CreateIndex
CREATE INDEX "attendance_amendments_mark_id_idx" ON "attendance_amendments"("mark_id");

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "activity_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_responsible_position_id_fkey" FOREIGN KEY ("responsible_position_id") REFERENCES "positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_types" ADD CONSTRAINT "activity_types_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_amendments" ADD CONSTRAINT "attendance_amendments_mark_id_fkey" FOREIGN KEY ("mark_id") REFERENCES "attendance_marks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_amendments" ADD CONSTRAINT "attendance_amendments_amended_by_fkey" FOREIGN KEY ("amended_by") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- AC-033.2: an amendment needs a real reason.
ALTER TABLE "attendance_amendments"
  ADD CONSTRAINT "attendance_amendments_reason_not_blank"
  CHECK (length(btrim("reason")) > 0);

-- AC-033.1: amendment history is append-only.
CREATE TRIGGER attendance_amendments_append_only
  BEFORE UPDATE OR DELETE ON "attendance_amendments"
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();