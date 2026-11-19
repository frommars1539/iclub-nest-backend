-- DropIndex
DROP INDEX "ledger_entries_one_reversal_per_entry";

-- AlterTable
ALTER TABLE "clubs" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'KES';

-- AlterTable
ALTER TABLE "receipt_references" ADD COLUMN     "void_reason" TEXT,
ADD COLUMN     "voided_at" TIMESTAMP(3),
ADD COLUMN     "voided_by" TEXT;

-- CreateTable
CREATE TABLE "dues_schedules" (
    "id" TEXT NOT NULL,
    "club_id" TEXT NOT NULL,
    "term_id" TEXT NOT NULL,
    "unit_id" TEXT,
    "amount_minor" INTEGER NOT NULL,

    CONSTRAINT "dues_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dues_payments" (
    "id" TEXT NOT NULL,
    "schedule_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "ledger_entry_id" TEXT NOT NULL,
    "recorded_by" TEXT NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dues_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dues_schedules_club_id_idx" ON "dues_schedules"("club_id");

-- CreateIndex
CREATE INDEX "dues_schedules_term_id_idx" ON "dues_schedules"("term_id");

-- CreateIndex
CREATE UNIQUE INDEX "dues_payments_ledger_entry_id_key" ON "dues_payments"("ledger_entry_id");

-- CreateIndex
CREATE INDEX "dues_payments_schedule_id_member_id_idx" ON "dues_payments"("schedule_id", "member_id");

-- CreateIndex
CREATE INDEX "dues_payments_member_id_idx" ON "dues_payments"("member_id");

-- AddForeignKey
ALTER TABLE "receipt_references" ADD CONSTRAINT "receipt_references_voided_by_fkey" FOREIGN KEY ("voided_by") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dues_schedules" ADD CONSTRAINT "dues_schedules_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dues_schedules" ADD CONSTRAINT "dues_schedules_term_id_fkey" FOREIGN KEY ("term_id") REFERENCES "terms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dues_schedules" ADD CONSTRAINT "dues_schedules_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dues_payments" ADD CONSTRAINT "dues_payments_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "dues_schedules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dues_payments" ADD CONSTRAINT "dues_payments_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dues_payments" ADD CONSTRAINT "dues_payments_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dues_payments" ADD CONSTRAINT "dues_payments_ledger_entry_id_fkey" FOREIGN KEY ("ledger_entry_id") REFERENCES "ledger_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- One currency per club: the code must look like an ISO code.
ALTER TABLE "clubs"
  ADD CONSTRAINT "clubs_currency_code" CHECK (char_length("currency") = 3);

-- ...and every ledger entry must use its club's currency. This replaces the
-- ledger_entry_guard() function from add_finance; the trigger itself already exists.
CREATE OR REPLACE FUNCTION ledger_entry_guard() RETURNS trigger AS $$
DECLARE
  fy_start      date;
  fy_end        date;
  fy_status     "FinancialYearStatus";
  club_currency text;
BEGIN
  SELECT fy."start_date", fy."end_date", fy."status", c."currency"
    INTO fy_start, fy_end, fy_status, club_currency
    FROM "financial_years" fy
    JOIN "clubs" c ON c."id" = fy."club_id"
   WHERE fy."id" = NEW."year_id";

  IF fy_status = 'CLOSED' THEN
    RAISE EXCEPTION 'financial year is closed';
  END IF;
  IF NEW."entry_date" < fy_start OR NEW."entry_date" > fy_end THEN
    RAISE EXCEPTION 'entry date is outside the financial year';
  END IF;
  IF NEW."currency" <> club_currency THEN
    RAISE EXCEPTION 'entry currency must match the club currency';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Dues: positive amounts, and at most one schedule per term per unit.
-- Two partial indexes, because NULL unit_id values never collide in a plain unique index.
ALTER TABLE "dues_schedules"
  ADD CONSTRAINT "dues_schedules_amount_positive" CHECK ("amount_minor" > 0);
CREATE UNIQUE INDEX "dues_schedules_one_per_term_unit"
  ON "dues_schedules" ("term_id", "unit_id") WHERE "unit_id" IS NOT NULL;
CREATE UNIQUE INDEX "dues_schedules_one_per_term_clubwide"
  ON "dues_schedules" ("term_id") WHERE "unit_id" IS NULL;

-- Receipts: void instead of delete. Void columns are all set together or all null.
ALTER TABLE "receipt_references"
  ADD CONSTRAINT "receipt_references_void_complete"
  CHECK (
    ("voided_at" IS NULL AND "voided_by" IS NULL AND "void_reason" IS NULL)
    OR
    ("voided_at" IS NOT NULL AND "voided_by" IS NOT NULL
       AND length(btrim("void_reason")) > 0)
  );

CREATE FUNCTION receipt_reference_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'receipt references cannot be deleted; void them instead';
  END IF;
  IF OLD."voided_at" IS NOT NULL THEN
    RAISE EXCEPTION 'receipt reference is already voided';
  END IF;
  IF NEW."entry_id" <> OLD."entry_id"
     OR NEW."reference" <> OLD."reference"
     OR NEW."added_by" <> OLD."added_by"
     OR NEW."added_at" <> OLD."added_at" THEN
    RAISE EXCEPTION 'only voiding a receipt reference is allowed';
  END IF;
  IF NEW."voided_at" IS NULL THEN
    RAISE EXCEPTION 'only voiding a receipt reference is allowed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER receipt_references_guard
  BEFORE UPDATE OR DELETE ON "receipt_references"
  FOR EACH ROW EXECUTE FUNCTION receipt_reference_guard();

  -- FR-043 instalments: a member's payments can never exceed what the schedule asks.
CREATE FUNCTION dues_payment_guard() RETURNS trigger AS $$
DECLARE
  owed          integer;
  paid          integer;
  this_amount   integer;
  this_dir      "FlowDirection";
  this_reverses text;
BEGIN
  -- Lock the schedule row so simultaneous instalments are checked one at a time.
  SELECT "amount_minor" INTO owed
    FROM "dues_schedules" WHERE "id" = NEW."schedule_id" FOR UPDATE;

  SELECT "amount_minor", "direction", "reverses_entry_id"
    INTO this_amount, this_dir, this_reverses
    FROM "ledger_entries" WHERE "id" = NEW."ledger_entry_id";

  IF this_dir <> 'INCOME' THEN
    RAISE EXCEPTION 'a dues payment must be backed by an income entry';
  END IF;
  IF this_reverses IS NOT NULL THEN
    RAISE EXCEPTION 'a reversal entry cannot back a dues payment';
  END IF;

  -- What this member has already paid, ignoring instalments that were reversed.
  SELECT COALESCE(SUM(le."amount_minor"), 0) INTO paid
    FROM "dues_payments" dp
    JOIN "ledger_entries" le ON le."id" = dp."ledger_entry_id"
   WHERE dp."schedule_id" = NEW."schedule_id"
     AND dp."member_id"   = NEW."member_id"
     AND NOT EXISTS (
       SELECT 1 FROM "ledger_entries" r WHERE r."reverses_entry_id" = le."id"
     );

  IF paid + this_amount > owed THEN
    RAISE EXCEPTION 'payment exceeds the dues still owed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER dues_payments_guard
  BEFORE INSERT ON "dues_payments"
  FOR EACH ROW EXECUTE FUNCTION dues_payment_guard();