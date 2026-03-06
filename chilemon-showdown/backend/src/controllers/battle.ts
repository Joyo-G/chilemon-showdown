import { Hono } from "hono";
import { authenticate } from "../auth";
import { dbBattles, dbTeamChilemon, dbTeams, dbUsers } from "../db";
import { BattleEngine } from "../services/battle/battleEngine";
import { BattleRuntime } from "../services/battle/battleHelpers";
import type {
  Battle,
  Player,
  TeamChilemon,
  Variables,
  Bindings,
} from "../types";

const router = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const loadTeamForUser = async (
  db: D1Database,
  teamId: string,
): Promise<TeamChilemon[]> => {
  return dbTeamChilemon.listForTeam(db, teamId);
};

const makePlayer = (
  userId: string,
  username: string,
  team: TeamChilemon[],
): Player => ({
  userId,
  username,
  team,
  activeIndex: 0,
  partyState: [],
  sideEffects: {},
  mustSwitch: false,
});

router.get("/battles/:id", authenticate, async (c) => {
  const userId =
    c.req.query("userId") ||
    (
      await c.req
        .json<{ userId?: string }>()
        .catch(() => ({ userId: undefined }))
    ).userId ||
    c.req.header("x-user-id") ||
    c.get("userId");

  if (!userId) {
    return c.json({ error: "userId es requerido" }, 400);
  }
  const callerId = String(userId);

  const battleId = c.req.param("id");
  if (!battleId) return c.json({ error: "id requerido" }, 400);

  const battle = await dbBattles.findById(c.env.DB, battleId);
  if (!battle) return c.json({ error: "Battle not found" }, 404);

  const isPlayer = battle.players.some((p) => p.userId === callerId);
  if (!isPlayer) return c.json({ error: "No perteneces a esta batalla" }, 403);

  return c.json(battle);
});

router.get("/:userId/battles", authenticate, async (c) => {
  const userId = c.req.param("userId");
  if (!userId) {
    return c.json({ error: "userId es requerido" }, 400);
  }

  const battles = await dbBattles.listAll(c.env.DB);
  const userBattles = battles.filter((battle) =>
    battle.players.some((p) => p.userId === userId),
  );
  return c.json(userBattles);
});

router.post("/battles", authenticate, async (c) => {
  const { userId, teamId } = await c.req.json<{
    userId?: string;
    teamId?: string;
  }>();
  if (!userId || !teamId) {
    return c.json({ error: "userId y teamId son requeridos" }, 400);
  }
  const requesterId: string = userId;
  const teamKey: string = teamId;

  const user = await dbUsers.findById(c.env.DB, requesterId);
  const teamUser = await dbTeams.findById(c.env.DB, teamKey);

  if (!user) return c.json({ error: "Usuario no encontrado" }, 404);
  if (!teamUser) return c.json({ error: "Equipo no encontrado" }, 404);
  if (teamUser.userId !== user.id)
    return c.json({ error: "Equipo no pertenece a dicho usuario" }, 404);

  const meId = user.id;
  const helpers = new BattleRuntime(c.env.DB);
  const engine = new BattleEngine(helpers);

  const waiting = await dbBattles.findWaiting(c.env.DB);

  if (waiting && waiting.players.length === 1) {
    const [firstPlayer] = waiting.players;
    if (firstPlayer && firstPlayer.userId !== meId) {
      const newTeam = await loadTeamForUser(c.env.DB, teamUser.id);
      const p2 = makePlayer(meId, user.username, newTeam);

      waiting.players[1] = p2;
      waiting.status = "in-progress";
      waiting.turn = 0;

      await engine.initializeBattle(waiting);
      await dbBattles.update(c.env.DB, waiting);
      return c.json(waiting);
    }
  }

  const myTeam = await loadTeamForUser(c.env.DB, teamUser.id);
  const p1 = makePlayer(meId, user.username, myTeam);

  const battle: Battle = {
    id: crypto.randomUUID(),
    status: "waiting",
    turn: 0,
    players: [p1],
    actions: [],
    log: [],
  };

  await dbBattles.insert(c.env.DB, battle);
  return c.json(battle, 201);
});

router.post("/battles/:id/move", authenticate, async (c) => {
  const { userId, moveId } = await c.req.json<{
    userId?: string;
    moveId?: number;
  }>();
  const battleId = c.req.param("id");
  if (!battleId) return c.json({ error: "id requerido" }, 400);

  const battle = await dbBattles.findById(c.env.DB, battleId);
  if (!battle) return c.json({ error: "Battle not found" }, 404);

  const callerId = userId ?? c.get("userId");
  if (!callerId) return c.json({ error: "Usuario no encontrado" }, 404);
  const actorId: string = callerId;

  const user = await dbUsers.findById(c.env.DB, actorId);
  if (!user) return c.json({ error: "Usuario no encontrado" }, 404);

  const moveIdNumber = Number(moveId);
  if (!Number.isFinite(moveIdNumber))
    return c.json({ error: "moveId invalido" }, 400);

  const helpers = new BattleRuntime(c.env.DB);
  const engine = new BattleEngine(helpers);

  await engine.submitMove(battle, user.id, moveIdNumber);
  await dbBattles.update(c.env.DB, battle);

  return c.json(battle);
});

router.post("/battles/:id/switch", authenticate, async (c) => {
  const { userId, toIndex } = await c.req.json<{
    userId?: string;
    toIndex?: number;
  }>();

  const battleId = c.req.param("id");
  if (!battleId) return c.json({ error: "id requerido" }, 400);

  const battle = await dbBattles.findById(c.env.DB, battleId);
  if (!battle) return c.json({ error: "Battle not found" }, 404);

  const callerId = userId ?? c.get("userId");
  if (!callerId) return c.json({ error: "Usuario no encontrado" }, 404);
  const actorId: string = callerId;

  const user = await dbUsers.findById(c.env.DB, actorId);
  if (!user) return c.json({ error: "Usuario no encontrado" }, 404);

  const toIndexNumber = Number(toIndex);
  if (!Number.isFinite(toIndexNumber))
    return c.json({ error: "toIndex invalido" }, 400);

  const helpers = new BattleRuntime(c.env.DB);
  const engine = new BattleEngine(helpers);

  await engine.submitSwitch(battle, user.id, toIndexNumber);
  await dbBattles.update(c.env.DB, battle);

  return c.json(battle);
});

router.post("/battles/:id/forfeit", authenticate, async (c) => {
  const { userId } = await c.req.json<{ userId?: string }>();
  const battleId = c.req.param("id");
  if (!battleId) return c.json({ error: "id requerido" }, 400);

  const battle = await dbBattles.findById(c.env.DB, battleId);
  if (!battle) return c.json({ error: "Battle not found" }, 404);

  const callerId = userId ?? c.get("userId");
  if (!callerId) return c.json({ error: "Usuario no encontrado" }, 404);
  const actorId: string = callerId;

  const user = await dbUsers.findById(c.env.DB, actorId);
  if (!user) return c.json({ error: "Usuario no encontrado" }, 404);

  const meId = user.id;
  const rival = battle.players.find((p) => p.userId !== meId);
  if (!rival) return c.json({ error: "No rival found" }, 400);

  battle.status = "finished";
  battle.winner = rival.userId;
  battle.log.push(`${user.username} se rindio. ${rival.username} gana!`);

  await dbBattles.update(c.env.DB, battle);
  return c.json(battle);
});

export default router;
