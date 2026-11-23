import type { Prisma } from '../../generated/prisma/client';

/** Account fields that are safe to return to clients: never includes `passwordHash`. */
export const publicUserSelect = {
  id: true,
  email: true,
  name: true,
  memberId: true,
} satisfies Prisma.UserAccountSelect;

export type PublicUser = Prisma.UserAccountGetPayload<{
  select: typeof publicUserSelect;
}>;
