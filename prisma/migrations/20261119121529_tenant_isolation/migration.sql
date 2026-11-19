/*
  Warnings:

  - Added the required column `club_id` to the `activity_events` table without a default value. This is not possible if the table is not empty.
  - Added the required column `club_id` to the `appointments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `club_id` to the `attendance_amendments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `club_id` to the `attendance_marks` table without a default value. This is not possible if the table is not empty.
  - Added the required column `club_id` to the `budget_lines` table without a default value. This is not possible if the table is not empty.
  - Added the required column `club_id` to the `custody_events` table without a default value. This is not possible if the table is not empty.
  - Added the required column `club_id` to the `dues_payments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `club_id` to the `ledger_entries` table without a default value. This is not possible if the table is not empty.
  - Added the required column `club_id` to the `member_events` table without a default value. This is not possible if the table is not empty.
  - Added the required column `club_id` to the `receipt_references` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "activity_events" ADD COLUMN     "club_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "club_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "attendance_amendments" ADD COLUMN     "club_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "attendance_marks" ADD COLUMN     "club_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "budget_lines" ADD COLUMN     "club_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "custody_events" ADD COLUMN     "club_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "dues_payments" ADD COLUMN     "club_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "ledger_entries" ADD COLUMN     "club_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "member_events" ADD COLUMN     "club_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "receipt_references" ADD COLUMN     "club_id" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "activity_events_club_id_idx" ON "activity_events"("club_id");

-- CreateIndex
CREATE INDEX "appointments_club_id_idx" ON "appointments"("club_id");

-- CreateIndex
CREATE INDEX "attendance_amendments_club_id_idx" ON "attendance_amendments"("club_id");

-- CreateIndex
CREATE INDEX "attendance_marks_club_id_idx" ON "attendance_marks"("club_id");

-- CreateIndex
CREATE INDEX "budget_lines_club_id_idx" ON "budget_lines"("club_id");

-- CreateIndex
CREATE INDEX "custody_events_club_id_idx" ON "custody_events"("club_id");

-- CreateIndex
CREATE INDEX "dues_payments_club_id_idx" ON "dues_payments"("club_id");

-- CreateIndex
CREATE INDEX "ledger_entries_club_id_idx" ON "ledger_entries"("club_id");

-- CreateIndex
CREATE INDEX "member_events_club_id_idx" ON "member_events"("club_id");

-- CreateIndex
CREATE INDEX "receipt_references_club_id_idx" ON "receipt_references"("club_id");

-- ============================================================
-- Tenant isolation (SRS CON-005, NFR-010)
-- 1) a row can only point at rows of its own club
-- 2) club_id never changes after a row is created
-- ============================================================

CREATE FUNCTION check_same_club() RETURNS trigger AS $$
DECLARE
  i            integer := 0;
  fk_col       text;
  parent_table text;
  fk_val       text;
  parent_club  text;
  row_json     jsonb := to_jsonb(NEW);
BEGIN
  -- Trigger arguments come in pairs: (foreign key column, parent table).
  WHILE i < TG_NARGS LOOP
    fk_col       := TG_ARGV[i];
    parent_table := TG_ARGV[i + 1];
    fk_val       := row_json ->> fk_col;

    IF fk_val IS NOT NULL THEN
      EXECUTE format('SELECT "club_id" FROM %I WHERE "id" = $1', parent_table)
        INTO parent_club USING fk_val;

      -- A missing parent is reported by the foreign key itself, so only compare
      -- when the parent exists.
      IF parent_club IS NOT NULL AND parent_club <> row_json ->> 'club_id' THEN
        RAISE EXCEPTION 'cross-club reference: %.% points at a row of % that belongs to another club',
          TG_TABLE_NAME, fk_col, parent_table;
      END IF;
    END IF;

    i := i + 2;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER members_same_club BEFORE INSERT OR UPDATE ON "members"
  FOR EACH ROW EXECUTE FUNCTION check_same_club('unit_id', 'units');

CREATE TRIGGER positions_same_club BEFORE INSERT OR UPDATE ON "positions"
  FOR EACH ROW EXECUTE FUNCTION check_same_club('unit_id', 'units');

CREATE TRIGGER appointments_same_club BEFORE INSERT OR UPDATE ON "appointments"
  FOR EACH ROW EXECUTE FUNCTION check_same_club(
    'position_id', 'positions',
    'member_id', 'members',
    'term_id', 'terms',
    'appointed_by', 'members');

CREATE TRIGGER invitations_same_club BEFORE INSERT OR UPDATE ON "invitations"
  FOR EACH ROW EXECUTE FUNCTION check_same_club('member_id', 'members');

CREATE TRIGGER member_events_same_club BEFORE INSERT OR UPDATE ON "member_events"
  FOR EACH ROW EXECUTE FUNCTION check_same_club('member_id', 'members');

CREATE TRIGGER activities_same_club BEFORE INSERT OR UPDATE ON "activities"
  FOR EACH ROW EXECUTE FUNCTION check_same_club(
    'unit_id', 'units',
    'type_id', 'activity_types',
    'responsible_position_id', 'positions');

CREATE TRIGGER attendance_marks_same_club BEFORE INSERT OR UPDATE ON "attendance_marks"
  FOR EACH ROW EXECUTE FUNCTION check_same_club(
    'activity_id', 'activities',
    'member_id', 'members',
    'marked_by', 'members');

CREATE TRIGGER activity_events_same_club BEFORE INSERT OR UPDATE ON "activity_events"
  FOR EACH ROW EXECUTE FUNCTION check_same_club('activity_id', 'activities');

CREATE TRIGGER attendance_amendments_same_club BEFORE INSERT OR UPDATE ON "attendance_amendments"
  FOR EACH ROW EXECUTE FUNCTION check_same_club(
    'mark_id', 'attendance_marks',
    'amended_by', 'members');

CREATE TRIGGER budget_lines_same_club BEFORE INSERT OR UPDATE ON "budget_lines"
  FOR EACH ROW EXECUTE FUNCTION check_same_club('year_id', 'financial_years');

CREATE TRIGGER ledger_entries_same_club BEFORE INSERT OR UPDATE ON "ledger_entries"
  FOR EACH ROW EXECUTE FUNCTION check_same_club(
    'year_id', 'financial_years',
    'budget_line_id', 'budget_lines',
    'reverses_entry_id', 'ledger_entries',
    'posted_by', 'members');

CREATE TRIGGER receipt_references_same_club BEFORE INSERT OR UPDATE ON "receipt_references"
  FOR EACH ROW EXECUTE FUNCTION check_same_club(
    'entry_id', 'ledger_entries',
    'added_by', 'members',
    'voided_by', 'members');

CREATE TRIGGER dues_schedules_same_club BEFORE INSERT OR UPDATE ON "dues_schedules"
  FOR EACH ROW EXECUTE FUNCTION check_same_club(
    'term_id', 'terms',
    'unit_id', 'units');

CREATE TRIGGER dues_payments_same_club BEFORE INSERT OR UPDATE ON "dues_payments"
  FOR EACH ROW EXECUTE FUNCTION check_same_club(
    'schedule_id', 'dues_schedules',
    'member_id', 'members',
    'ledger_entry_id', 'ledger_entries',
    'recorded_by', 'members');

CREATE TRIGGER record_items_same_club BEFORE INSERT OR UPDATE ON "record_items"
  FOR EACH ROW EXECUTE FUNCTION check_same_club('position_id', 'positions');

CREATE TRIGGER handovers_same_club BEFORE INSERT OR UPDATE ON "handovers"
  FOR EACH ROW EXECUTE FUNCTION check_same_club(
    'position_id', 'positions',
    'outgoing_member_id', 'members',
    'incoming_member_id', 'members');

CREATE TRIGGER handover_items_same_club BEFORE INSERT OR UPDATE ON "handover_items"
  FOR EACH ROW EXECUTE FUNCTION check_same_club(
    'handover_id', 'handovers',
    'record_id', 'record_items');

CREATE TRIGGER custody_events_same_club BEFORE INSERT OR UPDATE ON "custody_events"
  FOR EACH ROW EXECUTE FUNCTION check_same_club(
    'record_id', 'record_items',
    'from_position_id', 'positions',
    'to_position_id', 'positions',
    'handover_id', 'handovers',
    'actor_id', 'members');

-- club_id can never be changed, or a row could be moved out from under its children.
-- (The append-only tables already refuse every UPDATE, so they are not listed here.)
CREATE FUNCTION forbid_club_change() RETURNS trigger AS $$
BEGIN
  IF NEW."club_id" IS DISTINCT FROM OLD."club_id" THEN
    RAISE EXCEPTION 'club_id cannot be changed on %', TG_TABLE_NAME;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER units_club_immutable BEFORE UPDATE ON "units"
  FOR EACH ROW EXECUTE FUNCTION forbid_club_change();
CREATE TRIGGER members_club_immutable BEFORE UPDATE ON "members"
  FOR EACH ROW EXECUTE FUNCTION forbid_club_change();
CREATE TRIGGER terms_club_immutable BEFORE UPDATE ON "terms"
  FOR EACH ROW EXECUTE FUNCTION forbid_club_change();
CREATE TRIGGER positions_club_immutable BEFORE UPDATE ON "positions"
  FOR EACH ROW EXECUTE FUNCTION forbid_club_change();
CREATE TRIGGER invitations_club_immutable BEFORE UPDATE ON "invitations"
  FOR EACH ROW EXECUTE FUNCTION forbid_club_change();
CREATE TRIGGER import_reports_club_immutable BEFORE UPDATE ON "import_reports"
  FOR EACH ROW EXECUTE FUNCTION forbid_club_change();
CREATE TRIGGER activities_club_immutable BEFORE UPDATE ON "activities"
  FOR EACH ROW EXECUTE FUNCTION forbid_club_change();
CREATE TRIGGER activity_types_club_immutable BEFORE UPDATE ON "activity_types"
  FOR EACH ROW EXECUTE FUNCTION forbid_club_change();
CREATE TRIGGER financial_years_club_immutable BEFORE UPDATE ON "financial_years"
  FOR EACH ROW EXECUTE FUNCTION forbid_club_change();
CREATE TRIGGER record_items_club_immutable BEFORE UPDATE ON "record_items"
  FOR EACH ROW EXECUTE FUNCTION forbid_club_change();
CREATE TRIGGER handovers_club_immutable BEFORE UPDATE ON "handovers"
  FOR EACH ROW EXECUTE FUNCTION forbid_club_change();
CREATE TRIGGER dues_schedules_club_immutable BEFORE UPDATE ON "dues_schedules"
  FOR EACH ROW EXECUTE FUNCTION forbid_club_change();
CREATE TRIGGER appointments_club_immutable BEFORE UPDATE ON "appointments"
  FOR EACH ROW EXECUTE FUNCTION forbid_club_change();
CREATE TRIGGER attendance_marks_club_immutable BEFORE UPDATE ON "attendance_marks"
  FOR EACH ROW EXECUTE FUNCTION forbid_club_change();
CREATE TRIGGER budget_lines_club_immutable BEFORE UPDATE ON "budget_lines"
  FOR EACH ROW EXECUTE FUNCTION forbid_club_change();
CREATE TRIGGER receipt_references_club_immutable BEFORE UPDATE ON "receipt_references"
  FOR EACH ROW EXECUTE FUNCTION forbid_club_change();
CREATE TRIGGER dues_payments_club_immutable BEFORE UPDATE ON "dues_payments"
  FOR EACH ROW EXECUTE FUNCTION forbid_club_change();
CREATE TRIGGER handover_items_club_immutable BEFORE UPDATE ON "handover_items"
  FOR EACH ROW EXECUTE FUNCTION forbid_club_change();

  
