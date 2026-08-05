import type { Generated, Insertable, Selectable, Updateable } from 'kysely';

// ── Users ──────────────────────────────────────────────────────────────────

export interface UsersTable {
  id: Generated<number>;
  email: string;
  password_hash: string;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export type User = Selectable<UsersTable>;
export type NewUser = Insertable<UsersTable>;
export type UserUpdate = Updateable<UsersTable>;

// ── Database ───────────────────────────────────────────────────────────────

export interface Database {
  users: UsersTable;
}
