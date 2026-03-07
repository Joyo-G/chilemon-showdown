import schemaSQL from "../../schema.sql?raw";
import chilemonData from "../../data/chilemon_chileizados.json";
import movesData from "../../data/moves.json";

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
