-- CreateEnum
CREATE TYPE "RecordKind" AS ENUM ('DOCUMENT', 'ASSET');

-- CreateEnum
CREATE TYPE "DocType" AS ENUM ('CONSTITUTION', 'BUDGET', 'AUDIT', 'MINUTES', 'BRAND_FILE', 'OTHER');

-- CreateEnum
CREATE TYPE "RecordState" AS ENUM ('ACTIVE', 'LOST', 'DISPOSED', 'WRITTEN_OFF');

-- CreateEnum
CREATE TYPE "HandoverDisposition" AS ENUM ('TRANSFERRED', 'OUTSTANDING');

-- CreateEnum
CREATE TYPE "CustodyEventType" AS ENUM ('REGISTERED', 'TRANSFERRED', 'HANDED_OVER', 'RECEIVED_LATE', 'LOST', 'DISPOSED', 'WRITTEN_OFF');

-- CreateTable
CREATE TABLE "record_items" (
    "id" TEXT NOT NULL,
    "club_id" TEXT NOT NULL,
    "position_id" TEXT NOT NULL,
    "kind" "RecordKind" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "doc_type" "DocType",
    "period" TEXT,
    "mark" TEXT,
    "location" TEXT NOT NULL,
    "state" "RecordState" NOT NULL DEFAULT 'ACTIVE',
    "version_label" TEXT,
    "adopted_on" DATE,
    "is_current" BOOLEAN NOT NULL DEFAULT false,
    "outstanding_note" TEXT,

    CONSTRAINT "record_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "handovers" (
    "id" TEXT NOT NULL,
    "club_id" TEXT NOT NULL,
    "position_id" TEXT NOT NULL,
    "outgoing_member_id" TEXT NOT NULL,
    "incoming_member_id" TEXT NOT NULL,
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "outgoing_confirmed_at" TIMESTAMP(3),
    "incoming_confirmed_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "escalated_at" TIMESTAMP(3),
    "outgoing_receipt_sent_at" TIMESTAMP(3),
    "incoming_receipt_sent_at" TIMESTAMP(3),

    CONSTRAINT "handovers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "handover_items" (
    "id" TEXT NOT NULL,
    "handover_id" TEXT NOT NULL,
    "record_id" TEXT NOT NULL,
    "disposition" "HandoverDisposition",
    "note" TEXT,

    CONSTRAINT "handover_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custody_events" (
    "id" TEXT NOT NULL,
    "record_id" TEXT NOT NULL,
    "from_position_id" TEXT,
    "to_position_id" TEXT NOT NULL,
    "handover_id" TEXT,
    "event_type" "CustodyEventType" NOT NULL,
    "reason" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "custody_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "record_items_club_id_kind_idx" ON "record_items"("club_id", "kind");

-- CreateIndex
CREATE INDEX "record_items_position_id_idx" ON "record_items"("position_id");

-- CreateIndex
CREATE INDEX "handovers_club_id_idx" ON "handovers"("club_id");

-- CreateIndex
CREATE INDEX "handovers_position_id_idx" ON "handovers"("position_id");

-- CreateIndex
CREATE INDEX "handover_items_record_id_idx" ON "handover_items"("record_id");

-- CreateIndex
CREATE UNIQUE INDEX "handover_items_handover_id_record_id_key" ON "handover_items"("handover_id", "record_id");

-- CreateIndex
CREATE INDEX "custody_events_record_id_at_idx" ON "custody_events"("record_id", "at");

-- CreateIndex
CREATE INDEX "custody_events_handover_id_idx" ON "custody_events"("handover_id");

-- AddForeignKey
ALTER TABLE "record_items" ADD CONSTRAINT "record_items_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "record_items" ADD CONSTRAINT "record_items_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handovers" ADD CONSTRAINT "handovers_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handovers" ADD CONSTRAINT "handovers_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handovers" ADD CONSTRAINT "handovers_outgoing_member_id_fkey" FOREIGN KEY ("outgoing_member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handovers" ADD CONSTRAINT "handovers_incoming_member_id_fkey" FOREIGN KEY ("incoming_member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handover_items" ADD CONSTRAINT "handover_items_handover_id_fkey" FOREIGN KEY ("handover_id") REFERENCES "handovers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handover_items" ADD CONSTRAINT "handover_items_record_id_fkey" FOREIGN KEY ("record_id") REFERENCES "record_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custody_events" ADD CONSTRAINT "custody_events_record_id_fkey" FOREIGN KEY ("record_id") REFERENCES "record_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custody_events" ADD CONSTRAINT "custody_events_from_position_id_fkey" FOREIGN KEY ("from_position_id") REFERENCES "positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custody_events" ADD CONSTRAINT "custody_events_to_position_id_fkey" FOREIGN KEY ("to_position_id") REFERENCES "positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custody_events" ADD CONSTRAINT "custody_events_handover_id_fkey" FOREIGN KEY ("handover_id") REFERENCES "handovers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custody_events" ADD CONSTRAINT "custody_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ===== RecordItem rules =====

-- A document has a doc_type; an asset has none.
ALTER TABLE "record_items"
  ADD CONSTRAINT "record_items_kind_matches_doc_type"
  CHECK (
    ("kind" = 'DOCUMENT' AND "doc_type" IS NOT NULL)
    OR ("kind" = 'ASSET' AND "doc_type" IS NULL)
  );

-- FR-005: constitution versions carry a label and an adoption date.
ALTER TABLE "record_items"
  ADD CONSTRAINT "record_items_constitution_fields"
  CHECK (
    "doc_type" IS DISTINCT FROM 'CONSTITUTION'
    OR ("version_label" IS NOT NULL AND "adopted_on" IS NOT NULL)
  );

-- Only a constitution can be marked "current".
ALTER TABLE "record_items"
  ADD CONSTRAINT "record_items_current_only_constitution"
  CHECK ("is_current" = false OR "doc_type" = 'CONSTITUTION');

-- AC-005.1 / FR-005: exactly one current constitution per club.
CREATE UNIQUE INDEX "record_items_one_current_constitution"
  ON "record_items" ("club_id") WHERE "is_current" = true;

-- AC-051.2: only assets can be lost or disposed of.
ALTER TABLE "record_items"
  ADD CONSTRAINT "record_items_lost_disposed_assets_only"
  CHECK ("state" NOT IN ('LOST', 'DISPOSED') OR "kind" = 'ASSET');

-- An outstanding note, when present, says something.
ALTER TABLE "record_items"
  ADD CONSTRAINT "record_items_outstanding_note_not_blank"
  CHECK ("outstanding_note" IS NULL OR length(btrim("outstanding_note")) > 0);

-- ===== Handover rules =====

ALTER TABLE "handovers"
  ADD CONSTRAINT "handovers_distinct_parties"
  CHECK ("outgoing_member_id" <> "incoming_member_id");

-- AC-024.2: a handover cannot be closed on one party's confirmation alone.
ALTER TABLE "handovers"
  ADD CONSTRAINT "handovers_close_needs_both_confirmations"
  CHECK (
    "closed_at" IS NULL
    OR ("outgoing_confirmed_at" IS NOT NULL AND "incoming_confirmed_at" IS NOT NULL)
  );

-- BR-024.2: one open handover per office at a time.
CREATE UNIQUE INDEX "handovers_one_open_per_position"
  ON "handovers" ("position_id") WHERE "closed_at" IS NULL;

-- AC-024.1 and POST-024.1: no closing with unmarked items; closed handovers are immutable
-- (except the two receipt-sent timestamps, which are updated when emails go out).
CREATE FUNCTION handover_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'handovers cannot be deleted';
  END IF;

  IF OLD."closed_at" IS NULL AND NEW."closed_at" IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM "handover_items"
       WHERE "handover_id" = NEW."id" AND "disposition" IS NULL
    ) THEN
      RAISE EXCEPTION 'handover has items that are not marked yet';
    END IF;
  END IF;

  IF OLD."closed_at" IS NOT NULL THEN
    IF NEW."club_id" IS DISTINCT FROM OLD."club_id"
       OR NEW."position_id" IS DISTINCT FROM OLD."position_id"
       OR NEW."outgoing_member_id" IS DISTINCT FROM OLD."outgoing_member_id"
       OR NEW."incoming_member_id" IS DISTINCT FROM OLD."incoming_member_id"
       OR NEW."opened_at" IS DISTINCT FROM OLD."opened_at"
       OR NEW."outgoing_confirmed_at" IS DISTINCT FROM OLD."outgoing_confirmed_at"
       OR NEW."incoming_confirmed_at" IS DISTINCT FROM OLD."incoming_confirmed_at"
       OR NEW."closed_at" IS DISTINCT FROM OLD."closed_at"
       OR NEW."escalated_at" IS DISTINCT FROM OLD."escalated_at" THEN
      RAISE EXCEPTION 'a closed handover cannot be changed';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER handovers_guard
  BEFORE UPDATE OR DELETE ON "handovers"
  FOR EACH ROW EXECUTE FUNCTION handover_guard();

-- ===== HandoverItem rules =====

-- IN-024.3: an outstanding item needs a note.
ALTER TABLE "handover_items"
  ADD CONSTRAINT "handover_items_outstanding_needs_note"
  CHECK (
    "disposition" IS DISTINCT FROM 'OUTSTANDING'
    OR ("note" IS NOT NULL AND length(btrim("note")) > 0)
  );

-- Items of a closed handover are frozen.
CREATE FUNCTION handover_item_guard() RETURNS trigger AS $$
DECLARE
  hid    text;
  closed timestamp;
BEGIN
  IF TG_OP = 'INSERT' THEN
    hid := NEW."handover_id";
  ELSE
    hid := OLD."handover_id";
  END IF;

  SELECT "closed_at" INTO closed FROM "handovers" WHERE "id" = hid;
  IF closed IS NOT NULL THEN
    RAISE EXCEPTION 'items of a closed handover cannot be changed';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER handover_items_guard
  BEFORE INSERT OR UPDATE OR DELETE ON "handover_items"
  FOR EACH ROW EXECUTE FUNCTION handover_item_guard();

-- ===== CustodyEvent rules =====

-- Only a first registration has no "from" office.
ALTER TABLE "custody_events"
  ADD CONSTRAINT "custody_events_from_null_only_when_registered"
  CHECK (("event_type" = 'REGISTERED') = ("from_position_id" IS NULL));

-- A transfer must move between two different offices.
ALTER TABLE "custody_events"
  ADD CONSTRAINT "custody_events_transfer_changes_office"
  CHECK ("event_type" <> 'TRANSFERRED' OR "from_position_id" <> "to_position_id");

-- AC-054.2 and AC-051.2: every event carries a reason.
ALTER TABLE "custody_events"
  ADD CONSTRAINT "custody_events_reason_not_blank"
  CHECK (length(btrim("reason")) > 0);

-- AC-053.2: the transfer log is append-only. forbid_mutation() exists from add_access_audit.
CREATE TRIGGER custody_events_append_only
  BEFORE UPDATE OR DELETE ON "custody_events"
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();