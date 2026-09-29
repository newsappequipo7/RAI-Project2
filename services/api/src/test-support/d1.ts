import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DatabaseSync, SQLInputValue } from 'node:sqlite';

// Vite 5 does not know the `node:sqlite` builtin, so it is loaded through require instead of import.
const { DatabaseSync: SqliteDatabase } = createRequire(import.meta.url)(
  'node:sqlite',
) as typeof import('node:sqlite');

const MIGRATION_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../migrations/0001_init.sql',
);

class FakeStatement {
  constructor(
    private readonly db: DatabaseSync,
    private readonly sql: string,
    private readonly params: SQLInputValue[] = [],
  ) {}

  bind(...params: unknown[]) {
    return new FakeStatement(this.db, this.sql, params as SQLInputValue[]);
  }

  async first<T>(): Promise<T | null> {
    return (this.db.prepare(this.sql).get(...this.params) as T | undefined) ?? null;
  }

  async all<T>() {
    return { results: this.db.prepare(this.sql).all(...this.params) as T[] };
  }

  async run() {
    this.db.prepare(this.sql).run(...this.params);
    return { success: true };
  }
}

export interface TestD1 {
  d1: D1Database;
  sqlite: DatabaseSync;
}

export function createTestD1(): TestD1 {
  const sqlite = new SqliteDatabase(':memory:');
  sqlite.exec(readFileSync(MIGRATION_PATH, 'utf8'));

  const d1 = {
    prepare: (sql: string) => new FakeStatement(sqlite, sql),
    batch: (statements: FakeStatement[]) =>
      Promise.all(statements.map((statement) => statement.all())),
  } as unknown as D1Database;

  return { d1, sqlite };
}
