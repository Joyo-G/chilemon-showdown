import chilemonData from "../../data/chilemon_chileizados.json";
import movesData from "../../data/moves.json";

// Inline schema to avoid bundler loaders
const schemaSQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS team_chilemon (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL,
  chilemon_id INTEGER NOT NULL,
  position INTEGER NOT NULL,
  nickname TEXT NOT NULL,
  level INTEGER DEFAULT 100,
  moves TEXT NOT NULL,
  effort TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS chilemon (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  abilities TEXT NOT NULL,
  height INTEGER NOT NULL,
  weight INTEGER NOT NULL,
  moves TEXT NOT NULL,
  stats TEXT NOT NULL,
  types TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS moves (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  damage_class TEXT NOT NULL,
  power INTEGER,
  pp INTEGER NOT NULL,
  priority INTEGER DEFAULT 0,
  stat_changes TEXT NOT NULL,
  target TEXT NOT NULL,
  type TEXT NOT NULL,
  ailment TEXT NOT NULL,
  effect_entry TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS battles (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  status TEXT NOT NULL,
  turn INTEGER NOT NULL DEFAULT 0,
  winner TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_battles_status ON battles(status);
CREATE INDEX IF NOT EXISTS idx_teams_user ON teams(user_id);
CREATE INDEX IF NOT EXISTS idx_team_chilemon_team ON team_chilemon(team_id);
`;

const chunk = <T>(arr: T[], size: number) => {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
};

const seedChilemon = async (db: D1Database) => {
  const countRow = await db
    .prepare("SELECT COUNT(*) as count FROM chilemon")
    .first<{ count: number }>();
  if ((countRow?.count ?? 0) > 0) return;

  const statements = (chilemonData as any[]).map((row) =>
    db
      .prepare(
        "INSERT INTO chilemon (id, name, abilities, height, weight, moves, stats, types) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        row.id,
        row.name,
        JSON.stringify(row.abilities ?? []),
        row.height,
        row.weight,
        JSON.stringify(row.moves ?? []),
        JSON.stringify(row.stats ?? []),
        JSON.stringify(row.types ?? []),
      ),
  );

  for (const part of chunk(statements, 40)) {
    await db.batch(part);
  }
  console.log(`Seeded chilemon: ${(chilemonData as any[]).length} rows`);
};

const seedMoves = async (db: D1Database) => {
  const countRow = await db
    .prepare("SELECT COUNT(*) as count FROM moves")
    .first<{ count: number }>();
  if ((countRow?.count ?? 0) > 0) return;

  const statements = (movesData as any[]).map((row) =>
    db
      .prepare(
        "INSERT INTO moves (id, name, damage_class, power, pp, priority, stat_changes, target, type, ailment, effect_entry) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        row.id,
        row.name,
        row.damage_class,
        row.power ?? null,
        row.pp,
        row.priority ?? 0,
        JSON.stringify(row.stat_changes ?? []),
        row.target,
        row.type,
        row.ailment,
        row.effect_entry,
      ),
  );

  for (const part of chunk(statements, 40)) {
    await db.batch(part);
  }
  console.log(`Seeded moves: ${(movesData as any[]).length} rows`);
};

let baseDataPromise: Promise<void> | null = null;
let schemaPromise: Promise<void> | null = null;

export const ensureSchema = (db: D1Database) => {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      const statements = schemaSQL
        .split(/;\s*\n/)
        .map((s) => s.trim())
        .filter(Boolean);

      for (const stmt of statements) {
        await db.prepare(stmt).run();
      }
    })().catch((err) => {
      console.error("Failed to ensure schema", err);
      schemaPromise = null;
    });
  }
  return schemaPromise;
};

export const ensureBaseData = (db: D1Database) => {
  if (!baseDataPromise) {
    baseDataPromise = (async () => {
      await seedChilemon(db);
      await seedMoves(db);
    })().catch((err) => {
      console.error("Failed to seed base data", err);
      baseDataPromise = null;
    });
  }
  return baseDataPromise;
};
