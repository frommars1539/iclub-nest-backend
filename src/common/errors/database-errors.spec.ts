import { HttpStatus } from '@nestjs/common';
import { mapDatabaseMessage } from './database-errors';
import { ErrorCode } from './error-codes';

describe('mapDatabaseMessage', () => {
  it.each([
    ['payment exceeds the dues still owed', ErrorCode.DUES_OVERPAYMENT],
    ['financial year is closed', ErrorCode.YEAR_CLOSED],
    [
      'UPDATE on ledger_entries is not allowed (append-only table)',
      ErrorCode.ENTRY_IMMUTABLE,
    ],
    [
      'handover has items that are not marked yet',
      ErrorCode.HANDOVER_INCOMPLETE,
    ],
    [
      'cross-club reference: members.unit_id points at a row of units that belongs to another club',
      ErrorCode.CROSS_CLUB_REFERENCE,
    ],
    [
      'duplicate key value violates unique constraint "appointments_one_active_per_position_term"',
      ErrorCode.POSITION_OCCUPIED,
    ],
    [
      'new row for relation "activities" violates check constraint "activities_end_after_start"',
      ErrorCode.ACTIVITY_TIME_INVALID,
    ],
    [
      'new row for relation "ledger_entries" violates check constraint "ledger_entries_amount_positive"',
      ErrorCode.AMOUNT_INVALID,
    ],
  ])('maps "%s"', (text, code) => {
    expect(mapDatabaseMessage(text)?.code).toBe(code);
  });

  it('uses 409 for a closed year', () => {
    expect(mapDatabaseMessage('financial year is closed')?.status).toBe(
      HttpStatus.CONFLICT,
    );
  });

  it('returns null for unrelated text', () => {
    expect(mapDatabaseMessage('connection refused')).toBeNull();
  });
});
