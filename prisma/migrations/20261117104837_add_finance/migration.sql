-- CreateEnum
CREATE TYPE "FinancialYearStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "FlowDirection" AS ENUM ('INCOME', 'EXPENDITURE');

-- CreateTable
CREATE TABLE "financial_years" (
    "id" TEXT NOT NULL,
    "club_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "status" "FinancialYearStatus" NOT NULL DEFAULT 'OPEN',
    "opening_balance_minor" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "financial_years_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_lines" (
    "id" TEXT NOT NULL,
    "year_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "direction" "FlowDirection" NOT NULL,
    "planned_minor" INTEGER NOT NULL,

    CONSTRAINT "budget_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_entries" (
    "id" TEXT NOT NULL,
    "year_id" TEXT NOT NULL,
    "budget_line_id" TEXT NOT NULL,
    "direction" "FlowDirection" NOT NULL,
    "amount_minor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "entry_date" DATE NOT NULL,
    "counterparty" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "reverses_entry_id" TEXT,
    "posted_by" TEXT NOT NULL,
    "posted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipt_references" (
    "id" TEXT NOT NULL,
    "entry_id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "added_by" TEXT NOT NULL,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "receipt_references_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "financial_years_club_id_idx" ON "financial_years"("club_id");

-- CreateIndex
CREATE INDEX "budget_lines_year_id_idx" ON "budget_lines"("year_id");

-- CreateIndex
CREATE UNIQUE INDEX "budget_lines_id_year_id_direction_key" ON "budget_lines"("id", "year_id", "direction");

-- CreateIndex
CREATE INDEX "ledger_entries_year_id_entry_date_idx" ON "ledger_entries"("year_id", "entry_date");

-- CreateIndex
CREATE INDEX "ledger_entries_budget_line_id_idx" ON "ledger_entries"("budget_line_id");

-- CreateIndex
CREATE INDEX "receipt_references_entry_id_idx" ON "receipt_references"("entry_id");

-- AddForeignKey
ALTER TABLE "financial_years" ADD CONSTRAINT "financial_years_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_lines" ADD CONSTRAINT "budget_lines_year_id_fkey" FOREIGN KEY ("year_id") REFERENCES "financial_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_year_id_fkey" FOREIGN KEY ("year_id") REFERENCES "financial_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_budget_line_id_year_id_direction_fkey" FOREIGN KEY ("budget_line_id", "year_id", "direction") REFERENCES "budget_lines"("id", "year_id", "direction") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_reverses_entry_id_fkey" FOREIGN KEY ("reverses_entry_id") REFERENCES "ledger_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_posted_by_fkey" FOREIGN KEY ("posted_by") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipt_references" ADD CONSTRAINT "receipt_references_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "ledger_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipt_references" ADD CONSTRAINT "receipt_references_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- AC-040.2: financial years cannot overlap within a club.
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE "financial_years"
  ADD CONSTRAINT "financial_years_no_overlap"
  EXCLUDE USING gist (
    "club_id" WITH =,
    daterange("start_date", "end_date", '[]') WITH &&
  );
ALTER TABLE "financial_years"
  ADD CONSTRAINT "financial_years_dates_ordered" CHECK ("end_date" >= "start_date");

-- ERR-041.2: amounts are positive; direction, not sign, expresses the flow.
ALTER TABLE "ledger_entries"
  ADD CONSTRAINT "ledger_entries_amount_positive" CHECK ("amount_minor" > 0);
ALTER TABLE "ledger_entries"
  ADD CONSTRAINT "ledger_entries_currency_code" CHECK (char_length("currency") = 3);
ALTER TABLE "budget_lines"
  ADD CONSTRAINT "budget_lines_planned_not_negative" CHECK ("planned_minor" >= 0);

-- An entry can be reversed at most once (a plain unique index allows many NULLs).
CREATE UNIQUE INDEX "ledger_entries_one_reversal_per_entry"
  ON "ledger_entries" ("reverses_entry_id");

-- BR-041.1: the ledger is append-only. forbid_mutation() exists from add_access_audit.
CREATE TRIGGER ledger_entries_append_only
  BEFORE UPDATE OR DELETE ON "ledger_entries"
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

-- ERR-041.1 / AC-041.3: no entries in a closed year, none dated outside the year.
CREATE FUNCTION ledger_entry_guard() RETURNS trigger AS $$
DECLARE
  fy_start  date;
  fy_end    date;
  fy_status "FinancialYearStatus";
BEGIN
  SELECT "start_date", "end_date", "status"
    INTO fy_start, fy_end, fy_status
    FROM "financial_years" WHERE "id" = NEW."year_id";

  IF fy_status = 'CLOSED' THEN
    RAISE EXCEPTION 'financial year is closed';
  END IF;
  IF NEW."entry_date" < fy_start OR NEW."entry_date" > fy_end THEN
    RAISE EXCEPTION 'entry date is outside the financial year';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ledger_entries_guard
  BEFORE INSERT ON "ledger_entries"
  FOR EACH ROW EXECUTE FUNCTION ledger_entry_guard();