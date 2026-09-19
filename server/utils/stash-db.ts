import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

export interface StashRow {
  id: string
  envelope: string
  expires_at: number | null
  burn_after_reading: number
  created_at: number
}

let database: DatabaseSync | undefined

function getDatabase() {
  if (database) return database

  const configuredPath = useRuntimeConfig().stashDatabasePath || '.data/stashes.sqlite'
  const databasePath = resolve(process.cwd(), configuredPath)
  mkdirSync(dirname(databasePath), { recursive: true })

  database = new DatabaseSync(databasePath)
  database.exec(`
    CREATE TABLE IF NOT EXISTS stashes (
      id TEXT PRIMARY KEY,
      envelope TEXT NOT NULL,
      expires_at INTEGER,
      burn_after_reading INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    ) STRICT;
    CREATE INDEX IF NOT EXISTS stashes_expires_at_idx ON stashes (expires_at);
  `)

  return database
}

export function createStash(row: Omit<StashRow, 'created_at'>) {
  const createdAt = Date.now()
  getDatabase()
    .prepare(`
      INSERT INTO stashes (id, envelope, expires_at, burn_after_reading, created_at)
      VALUES (?, ?, ?, ?, ?)
    `)
    .run(row.id, row.envelope, row.expires_at, row.burn_after_reading, createdAt)

  return createdAt
}

export function getStash(id: string): StashRow | undefined {
  const row = getDatabase()
    .prepare('SELECT id, envelope, expires_at, burn_after_reading, created_at FROM stashes WHERE id = ?')
    .get(id) as StashRow | undefined

  if (row?.expires_at !== null && row && row.expires_at <= Date.now()) {
    deleteStash(id)
    return undefined
  }

  return row
}

export function consumeStash(id: string): StashRow | undefined {
  return getDatabase()
    .prepare(`
      DELETE FROM stashes
      WHERE id = ? AND (expires_at IS NULL OR expires_at > ?)
      RETURNING id, envelope, expires_at, burn_after_reading, created_at
    `)
    .get(id, Date.now()) as StashRow | undefined
}

export function purgeExpiredStashes() {
  return getDatabase()
    .prepare('DELETE FROM stashes WHERE expires_at IS NOT NULL AND expires_at <= ?')
    .run(Date.now())
}
