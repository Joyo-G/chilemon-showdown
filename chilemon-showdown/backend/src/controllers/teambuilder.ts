import { Hono } from "hono";
import { authenticate } from "../auth";
import { dbChilemon, dbTeamChilemon, dbTeams } from "../db";
import type {
  Bindings,
  TeamChilemon as TeamChilemonType,
  Variables,
} from "../types";

const router = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const findChilemonName = async (
  db: D1Database,
  id: number,
): Promise<string | null> => {
  const doc = await dbChilemon.findById(db, id);
  return doc?.name ?? null;
};

router.get("/teams", authenticate, async (c) => {
  try {
    const userId = c.get("userId");
    if (!userId) return c.json({ error: "not authenticated" }, 401);
    const ownerId: string = userId;
    const teams = await dbTeams.listByUser(c.env.DB, ownerId);
    return c.json(teams);
  } catch (error) {
    console.error("Error fetching teams:", error);
    return c.json({ error: "Error fetching teams" }, 500);
  }
});

router.get("/teams/:id", authenticate, async (c) => {
  try {
    const userId = c.get("userId");
    if (!userId) return c.json({ error: "not authenticated" }, 401);
    const ownerId: string = userId;
    const teamId = c.req.param("id");
    if (!teamId) return c.json({ error: "Team id is required" }, 400);
    const team = await dbTeams.findByIdForUser(c.env.DB, teamId, ownerId);

    if (!team) {
      return c.json({ error: "Team not found" }, 404);
    }

    return c.json(team);
  } catch (error) {
    console.error("Error fetching team:", error);
    return c.json({ error: "Error fetching team" }, 500);
  }
});

router.post("/teams", authenticate, async (c) => {
  try {
    const userId = c.get("userId");
    if (!userId) return c.json({ error: "not authenticated" }, 401);
    const ownerId: string = userId;
    const { name, members } = await c.req.json<{
      name?: string;
      members?: { pokemonId: number; moves: number[] }[];
    }>();

    if (!name || !name.trim()) {
      return c.json({ error: "Team name is required" }, 400);
    }

    if (!members || !Array.isArray(members)) {
      return c.json({ error: "Members array is required" }, 400);
    }

    if (members.length === 0 || members.length > 6) {
      return c.json({ error: "Team must have between 1 and 6 members" }, 400);
    }

    const savedTeam = await dbTeams.insert(c.env.DB, ownerId, name);

    const teamMembers: Omit<TeamChilemonType, "id">[] = await Promise.all(
      members.map(async (member, index) => {
        const nameFromDb = await findChilemonName(c.env.DB, member.pokemonId);
        return {
          teamId: savedTeam.id,
          chilemonId: member.pokemonId,
          position: index,
          nickname: nameFromDb || `Pokemon${member.pokemonId}`,
          level: 100,
          moves: member.moves || [],
          effort: [],
        };
      }),
    );

    await dbTeamChilemon.insertMany(c.env.DB, teamMembers);

    return c.json(savedTeam, 201);
  } catch (error) {
    console.error("Error creating team:", error);
    return c.json({ error: "Error creating team" }, 500);
  }
});

router.put("/teams/:id", authenticate, async (c) => {
  try {
    const userId = c.get("userId");
    if (!userId) return c.json({ error: "not authenticated" }, 401);
    const ownerId: string = userId;
    const teamId = c.req.param("id");
    if (!teamId) return c.json({ error: "Team id is required" }, 400);
    const { name, members } = await c.req.json<{
      name?: string;
      members?: { pokemonId: number; moves: number[] }[];
    }>();

    if (!name || !name.trim()) {
      return c.json({ error: "Team name is required" }, 400);
    }

    const team = await dbTeams.findByIdForUser(c.env.DB, teamId, ownerId);
    if (!team) {
      return c.json({ error: "Team not found" }, 404);
    }

    await dbTeams.update(c.env.DB, team.id, ownerId, name);

    if (members && Array.isArray(members)) {
      if (members.length === 0 || members.length > 6) {
        return c.json({ error: "Team must have between 1 and 6 members" }, 400);
      }

      await dbTeamChilemon.deleteByTeam(c.env.DB, team.id);

      const teamMembers: Omit<TeamChilemonType, "id">[] = await Promise.all(
        members.map(async (member, index) => {
          const nameFromDb = await findChilemonName(c.env.DB, member.pokemonId);
          return {
            teamId: team.id,
            chilemonId: member.pokemonId,
            position: index,
            nickname: nameFromDb || `Pokemon${member.pokemonId}`,
            level: 100,
            moves: member.moves || [],
            effort: [],
          };
        }),
      );
      await dbTeamChilemon.insertMany(c.env.DB, teamMembers);
    }

    const updated = await dbTeams.findByIdForUser(c.env.DB, team.id, ownerId);
    return c.json(updated);
  } catch (error) {
    console.error("Error updating team:", error);
    return c.json({ error: "Error updating team" }, 500);
  }
});

router.delete("/teams/:id", authenticate, async (c) => {
  try {
    const userId = c.get("userId");
    if (!userId) return c.json({ error: "not authenticated" }, 401);
    const ownerId: string = userId;
    const teamId = c.req.param("id");
    if (!teamId) return c.json({ error: "Team id is required" }, 400);

    const team = await dbTeams.findByIdForUser(c.env.DB, teamId, ownerId);
    if (!team) {
      return c.json({ error: "Team not found" }, 404);
    }

    await dbTeamChilemon.deleteByTeam(c.env.DB, team.id);
    await dbTeams.remove(c.env.DB, team.id, ownerId);

    return c.json({ message: "Team deleted successfully" });
  } catch (error) {
    console.error("Error deleting team:", error);
    return c.json({ error: "Error deleting team" }, 500);
  }
});

router.get("/teamChilemon", authenticate, async (c) => {
  try {
    const teamId = c.req.query("teamId");
    if (!teamId) {
      return c.json({ error: "teamId is required" }, 400);
    }

    const teamKey: string = teamId;
    const members = await dbTeamChilemon.listForTeam(c.env.DB, teamKey);
    return c.json(members);
  } catch (error) {
    console.error("Error fetching team members:", error);
    return c.json({ error: "Error fetching team members" }, 500);
  }
});

export default router;
