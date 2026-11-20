import { HttpStatus } from '@nestjs/common';
import { ErrorCode } from './error-codes';

export interface MappedError {
  code: ErrorCode;
  status: HttpStatus;
  message: string;
}

interface Rule {
  /** Lower-case text to look for anywhere in the database error message. */
  match: string;
  error: MappedError;
}

const rule = (
  match: string,
  code: ErrorCode,
  status: HttpStatus,
  message: string,
): Rule => ({ match, error: { code, status, message } });

const CONFLICT = HttpStatus.CONFLICT;
const UNPROCESSABLE = HttpStatus.UNPROCESSABLE_ENTITY;

/**
 * Every message below comes from a trigger or a named constraint in the SQL
 * migrations. If you rename one there, rename it here too.
 */
const RULES: readonly Rule[] = [
  // ---- trigger messages ----
  rule(
    'financial year is closed',
    ErrorCode.YEAR_CLOSED,
    CONFLICT,
    'The financial year is closed.',
  ),
  rule(
    'entry date is outside the financial year',
    ErrorCode.ENTRY_DATE_OUT_OF_YEAR,
    UNPROCESSABLE,
    'The entry date is outside the financial year.',
  ),
  rule(
    'entry currency must match the club currency',
    ErrorCode.CURRENCY_MISMATCH,
    UNPROCESSABLE,
    'The entry currency must match the club currency.',
  ),
  rule(
    'payment exceeds the dues still owed',
    ErrorCode.DUES_OVERPAYMENT,
    UNPROCESSABLE,
    'The payment is more than the dues still owed.',
  ),
  rule(
    'a dues payment must be backed by an income entry',
    ErrorCode.DUES_ENTRY_INVALID,
    UNPROCESSABLE,
    'A dues payment must be backed by an income entry.',
  ),
  rule(
    'a reversal entry cannot back a dues payment',
    ErrorCode.DUES_ENTRY_INVALID,
    UNPROCESSABLE,
    'A reversal entry cannot back a dues payment.',
  ),
  rule(
    '(append-only table)',
    ErrorCode.ENTRY_IMMUTABLE,
    CONFLICT,
    'This record is append-only and cannot be changed or deleted.',
  ),
  rule(
    'receipt references cannot be deleted',
    ErrorCode.ENTRY_IMMUTABLE,
    CONFLICT,
    'Receipt references cannot be deleted; void them instead.',
  ),
  rule(
    'only voiding a receipt reference is allowed',
    ErrorCode.ENTRY_IMMUTABLE,
    CONFLICT,
    'A receipt reference can only be voided, not edited.',
  ),
  rule(
    'receipt reference is already voided',
    ErrorCode.RECEIPT_ALREADY_VOIDED,
    CONFLICT,
    'This receipt reference is already voided.',
  ),
  rule(
    'handover has items that are not marked yet',
    ErrorCode.HANDOVER_INCOMPLETE,
    CONFLICT,
    'Every item must be marked before the handover can close.',
  ),
  rule(
    'a closed handover cannot be changed',
    ErrorCode.HANDOVER_CLOSED,
    CONFLICT,
    'This handover is closed and cannot be changed.',
  ),
  rule(
    'items of a closed handover cannot be changed',
    ErrorCode.HANDOVER_CLOSED,
    CONFLICT,
    'This handover is closed and cannot be changed.',
  ),
  rule(
    'handovers cannot be deleted',
    ErrorCode.ENTRY_IMMUTABLE,
    CONFLICT,
    'Handovers cannot be deleted.',
  ),
  rule(
    'cross-club reference',
    ErrorCode.CROSS_CLUB_REFERENCE,
    HttpStatus.FORBIDDEN,
    'That record belongs to a different club.',
  ),

  // ---- constraint and index names ----
  rule(
    'appointments_one_active_per_position_term',
    ErrorCode.POSITION_OCCUPIED,
    CONFLICT,
    'This position already has a holder for the term.',
  ),
  rule(
    'handovers_one_open_per_position',
    ErrorCode.HANDOVER_ALREADY_OPEN,
    CONFLICT,
    'A handover is already open for this office.',
  ),
  rule(
    'handovers_close_needs_both_confirmations',
    ErrorCode.HANDOVER_UNCONFIRMED,
    CONFLICT,
    'Both parties must confirm before the handover can close.',
  ),
  rule(
    'ledger_entries_one_reversal_per_entry',
    ErrorCode.ENTRY_ALREADY_REVERSED,
    CONFLICT,
    'This entry has already been reversed.',
  ),
  rule(
    'ledger_entries_amount_positive',
    ErrorCode.AMOUNT_INVALID,
    UNPROCESSABLE,
    'The amount must be greater than zero.',
  ),
  rule(
    'record_items_one_current_constitution',
    ErrorCode.CONSTITUTION_CURRENT_EXISTS,
    CONFLICT,
    'The club already has a current constitution.',
  ),
  rule(
    'financial_years_no_overlap',
    ErrorCode.YEAR_OVERLAP,
    CONFLICT,
    'Financial years cannot overlap.',
  ),
  rule(
    'dues_schedules_one_per_term_unit',
    ErrorCode.DUES_SCHEDULE_EXISTS,
    CONFLICT,
    'A dues schedule already exists for this term and unit.',
  ),
  rule(
    'dues_schedules_one_per_term_clubwide',
    ErrorCode.DUES_SCHEDULE_EXISTS,
    CONFLICT,
    'A club-wide dues schedule already exists for this term.',
  ),
  rule(
    'activities_end_after_start',
    ErrorCode.ACTIVITY_TIME_INVALID,
    UNPROCESSABLE,
    'An activity cannot end before it starts.',
  ),
  rule(
    'attendance_amendments_reason_not_blank',
    ErrorCode.REASON_REQUIRED,
    UNPROCESSABLE,
    'A reason is required.',
  ),
  rule(
    'handover_items_outstanding_needs_note',
    ErrorCode.NOTE_REQUIRED,
    UNPROCESSABLE,
    'An outstanding item needs a note.',
  ),
];

/** Returns the API error for a known database rule, or null if the text matches none. */
export function mapDatabaseMessage(text: string): MappedError | null {
  const lower = text.toLowerCase();
  for (const { match, error } of RULES) {
    if (lower.includes(match)) return error;
  }
  return null;
}
