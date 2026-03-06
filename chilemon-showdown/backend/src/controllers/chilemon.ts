import { Hono } from "hono";
import { dbChilemon } from "../db";
import type { Bindings, Variables } from "../types";

const router = new Hono<{ Bindings: Bindings; Variables: Variables }>();

router.get("/", async (c) => {
  try {
    const chilemon = await dbChilemon.listAll(c.env.DB);
    return c.json(chilemon);
  } catch (error) {
    console.error("Error fetching Chilemon:", error);
    return c.json({ error: "Error fetching Chilemon" }, 500);
  }
});

router.get("/:id", async (c) => {
  try {
    const chilemon = await dbChilemon.findById(
      c.env.DB,
      Number(c.req.param("id")),
    );

    if (!chilemon) {
      return c.json({ error: "Chilemon not found" }, 404);
    }

    return c.json(chilemon);
  } catch (error) {
    console.error("Error fetching Chilemon:", error);
    return c.json({ error: "Error fetching Chilemon" }, 500);
  }
});

export default router;
