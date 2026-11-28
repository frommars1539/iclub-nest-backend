import { toMemberResponse, type MemberRow } from './members.mapper';

const row: MemberRow = {
  id: 'm1',
  memberNumber: 'CS/001',
  fullName: 'Amina Otieno',
  unitId: 'u1',
  status: 'DEPARTED',
  events: [
    {
      id: 'e1',
      at: new Date('2026-11-01T08:30:00.000Z'),
      actor: 'Jeremy Owiti',
      text: 'Added to the register',
    },
  ],
};

describe('toMemberResponse', () => {
  it('returns exactly the frontend Member shape', () => {
    expect(toMemberResponse(row)).toEqual({
      id: 'm1',
      memberNumber: 'CS/001',
      fullName: 'Amina Otieno',
      unitId: 'u1',
      status: 'departing',
      history: [
        {
          id: 'e1',
          at: '2026-11-01T08:30:00.000Z',
          by: 'Jeremy Owiti',
          text: 'Added to the register',
        },
      ],
    });
  });

  it('serialises a null member number as an empty string', () => {
    expect(toMemberResponse({ ...row, memberNumber: null }).memberNumber).toBe(
      '',
    );
  });

  it('keeps a missing unit as null and an empty history as an empty list', () => {
    const out = toMemberResponse({ ...row, unitId: null, events: [] });
    expect(out.unitId).toBeNull();
    expect(out.history).toEqual([]);
  });
});
