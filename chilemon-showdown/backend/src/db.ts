import {
  Battle,
  Chilemon as ChilemonRow,
  Move,
  Team,
  TeamChilemon,
  User,
  UUID,
  Action,
} from "./types";

const parseJson = <T>(value: unknown, fallback: T): T => {
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return fallback;
};

const mapUser = (row: any): User => ({
  id: String(row.id),
  username: row.username,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapTeam = (row: any): Team => ({
  id: String(row.id),
  userId: String(row.user_id),
  name: row.name,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapTeamChilemon = (row: any): TeamChilemon => ({
  id: String(row.id),
  teamId: String(row.team_id),
  chilemonId: Number(row.chilemon_id),
  position: Number(row.position),
  nickname: row.nickname,
  level: Number(row.level ?? 100),
  moves: parseJson<number[]>(row.moves, []),
  effort: parseJson<number[]>(row.effort, []),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapChilemon = (row: any): ChilemonRow => ({
  id: Number(row.id),
  name: row.name,
  abilities: parseJson(row.abilities, []),
  height: Number(row.height),
  weight: Number(row.weight),
  moves: parseJson(row.moves, []),
  stats: parseJson(row.stats, []),
  types: parseJson(row.types, []),
});

const mapMove = (row: any): Move => ({
  id: Number(row.id),
  name: row.name,
  damage_class: row.damage_class,
  power:
    row.power === null || row.power === undefined ? null : Number(row.power),
  pp: Number(row.pp),
  priority: Number(row.priority ?? 0),
  stat_changes: parseJson(row.stat_changes, []),
  target: row.target,
  type: row.type,
  ailment: row.ailment,
  effect_entry: row.effect_entry,
});

const mapBattle = (row: any): Battle => {
  const parsed = parseJson<Battle>(row.data, {
    id: String(row.id),
    players: [],
    turn: 0,
    actions: [],
    log: [],
    status: "waiting",
  });

  const winner = row.winner ? String(row.winner) : parsed.winner;
  const createdAt = (row.created_at as string | undefined) ?? parsed.createdAt;
  const updatedAt = (row.updated_at as string | undefined) ?? parsed.updatedAt;

  return {
    ...parsed,
    id: parsed.id || String(row.id),
    status: ((row.status as Battle["status"] | undefined) ??
      parsed.status) as Battle["status"],
    turn: Number(row.turn ?? parsed.turn ?? 0),
    ...(winner ? { winner } : {}),
    ...(createdAt ? { createdAt } : {}),
    ...(updatedAt ? { updatedAt } : {}),
  };
};

export const dbUsers = {
  async list(db: D1Database): Promise<User[]> {
    const res = await db
      .prepare("SELECT id, username, created_at, updated_at FROM users")
      .all();
    return (res.results ?? []).map(mapUser);
  },

  async findByUsername(db: D1Database, username: string): Promise<User | null> {
    const row = await db
      .prepare("SELECT * FROM users WHERE username = ? LIMIT 1")
      .bind(username)
      .first();
    return row ? mapUser(row) : null;
  },

  async findById(db: D1Database, id: UUID): Promise<User | null> {
    const row = await db
      .prepare("SELECT * FROM users WHERE id = ? LIMIT 1")
      .bind(id)
      .first();
    return row ? mapUser(row) : null;
  },

  async insert(
    db: D1Database,
    username: string,
    passwordHash: string,
  ): Promise<User> {
    const id = crypto.randomUUID();
    await db
      .prepare(
        "INSERT INTO users (id, username, password, created_at, updated_at) VALUES (?, ?, ?, datetime('now'), datetime('now'))",
      )
      .bind(id, username, passwordHash)
      .run();
    const inserted = await db
      .prepare("SELECT * FROM users WHERE id = ?")
      .bind(id)
      .first();
    return mapUser(inserted!);
  },

  async getWithPassword(
    db: D1Database,
    username: string,
  ): Promise<User | null> {
    const row = await db
      .prepare("SELECT * FROM users WHERE username = ? LIMIT 1")
      .bind(username)
      .first();
    if (!row) return null;
    const base = mapUser(row);
    if (typeof row.password === "string") {
      return { ...base, password: row.password };
    }
    return base;
  },
};

export const dbTeams = {
  async listByUser(db: D1Database, userId: UUID): Promise<Team[]> {
    const res = await db
      .prepare("SELECT * FROM teams WHERE user_id = ? ORDER BY created_at DESC")
      .bind(userId)
      .all();
    return (res.results ?? []).map(mapTeam);
  },

  async findById(db: D1Database, id: UUID): Promise<Team | null> {
    const row = await db
      .prepare("SELECT * FROM teams WHERE id = ? LIMIT 1")
      .bind(id)
      .first();
    return row ? mapTeam(row) : null;
  },

  async findByIdForUser(
    db: D1Database,
    id: UUID,
    userId: UUID,
  ): Promise<Team | null> {
    const row = await db
      .prepare("SELECT * FROM teams WHERE id = ? AND user_id = ? LIMIT 1")
      .bind(id, userId)
      .first();
    return row ? mapTeam(row) : null;
  },

  async insert(db: D1Database, userId: UUID, name: string): Promise<Team> {
    const id = crypto.randomUUID();
    await db
      .prepare(
        "INSERT INTO teams (id, user_id, name, created_at, updated_at) VALUES (?, ?, ?, datetime('now'), datetime('now'))",
      )
      .bind(id, userId, name)
      .run();
    const row = await db
      .prepare("SELECT * FROM teams WHERE id = ?")
      .bind(id)
      .first();
    return mapTeam(row!);
  },

  async update(
    db: D1Database,
    id: UUID,
    userId: UUID,
    name: string,
  ): Promise<Team | null> {
    await db
      .prepare(
        "UPDATE teams SET name = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?",
      )
      .bind(name, id, userId)
      .run();
    return dbTeams.findByIdForUser(db, id, userId);
  },

  async remove(db: D1Database, id: UUID, userId: UUID): Promise<boolean> {
    const res = await db
      .prepare("DELETE FROM teams WHERE id = ? AND user_id = ?")
      .bind(id, userId)
      .run();
    return Boolean(res.success);
  },
};

export const dbTeamChilemon = {
  async listForTeam(db: D1Database, teamId: UUID): Promise<TeamChilemon[]> {
    const res = await db
      .prepare(
        "SELECT * FROM team_chilemon WHERE team_id = ? ORDER BY position ASC",
      )
      .bind(teamId)
      .all();
    return (res.results ?? []).map(mapTeamChilemon);
  },

  async insertMany(
    db: D1Database,
    rows: Omit<TeamChilemon, "id">[],
  ): Promise<void> {
    const statements = rows.map((row) =>
      db
        .prepare(
          "INSERT INTO team_chilemon (id, team_id, chilemon_id, position, nickname, level, moves, effort, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))",
        )
        .bind(
          crypto.randomUUID(),
          row.teamId,
          row.chilemonId,
          row.position,
          row.nickname,
          row.level ?? 100,
          JSON.stringify(row.moves ?? []),
          JSON.stringify(row.effort ?? []),
        ),
    );
    if (statements.length > 0) {
      await db.batch(statements);
    }
  },

  async deleteByTeam(db: D1Database, teamId: UUID): Promise<void> {
    await db
      .prepare("DELETE FROM team_chilemon WHERE team_id = ?")
      .bind(teamId)
      .run();
  },
};

export const dbChilemon = {
  async listAll(db: D1Database): Promise<ChilemonRow[]> {
    const res = await db
      .prepare("SELECT * FROM chilemon ORDER BY id ASC")
      .all();
    return (res.results ?? []).map(mapChilemon);
  },

  async findById(db: D1Database, id: number): Promise<ChilemonRow | null> {
    const row = await db
      .prepare("SELECT * FROM chilemon WHERE id = ?")
      .bind(id)
      .first();
    return row ? mapChilemon(row) : null;
  },
};

export const dbMoves = {
  async listAll(db: D1Database): Promise<Move[]> {
    const res = await db.prepare("SELECT * FROM moves ORDER BY id ASC").all();
    return (res.results ?? []).map(mapMove);
  },

  async findById(db: D1Database, id: number): Promise<Move | null> {
    const row = await db
      .prepare("SELECT * FROM moves WHERE id = ?")
      .bind(id)
      .first();
    return row ? mapMove(row) : null;
  },
};

export const dbBattles = {
  async insert(db: D1Database, battle: Battle): Promise<Battle> {
    await db
      .prepare(
        "INSERT INTO battles (id, data, status, turn, winner, created_at, updated_at) VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))",
      )
      .bind(
        battle.id,
        JSON.stringify(battle),
        battle.status,
        battle.turn,
        battle.winner ?? null,
      )
      .run();
    const row = await db
      .prepare("SELECT * FROM battles WHERE id = ?")
      .bind(battle.id)
      .first();
    return mapBattle(row!);
  },

  async update(db: D1Database, battle: Battle): Promise<void> {
    await db
      .prepare(
        "UPDATE battles SET data = ?, status = ?, turn = ?, winner = ?, updated_at = datetime('now') WHERE id = ?",
      )
      .bind(
        JSON.stringify(battle),
        battle.status,
        battle.turn,
        battle.winner ?? null,
        battle.id,
      )
      .run();
  },

  async findById(db: D1Database, id: UUID): Promise<Battle | null> {
    const row = await db
      .prepare("SELECT * FROM battles WHERE id = ?")
      .bind(id)
      .first();
    return row ? mapBattle(row) : null;
  },

  async findWaiting(db: D1Database): Promise<Battle | null> {
    const row = await db
      .prepare("SELECT * FROM battles WHERE status = 'waiting' LIMIT 1")
      .first();
    return row ? mapBattle(row) : null;
  },

  async listAll(db: D1Database): Promise<Battle[]> {
    const res = await db
      .prepare("SELECT * FROM battles ORDER BY created_at DESC")
      .all();
    return (res.results ?? []).map(mapBattle);
  },

  async reset(db: D1Database): Promise<void> {
    await db.batch([
      db.prepare("DELETE FROM battles"),
      db.prepare("DELETE FROM team_chilemon"),
      db.prepare("DELETE FROM teams"),
      db.prepare("DELETE FROM users"),
    ]);
  },
};

export const dbUtil = {
  async resetData(db: D1Database): Promise<void> {
    await db.batch([
      db.prepare("DELETE FROM team_chilemon"),
      db.prepare("DELETE FROM teams"),
      db.prepare("DELETE FROM users"),
      db.prepare("DELETE FROM battles"),
    ]);
  },
};
