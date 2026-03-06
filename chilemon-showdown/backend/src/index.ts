import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import loginRouter from "./controllers/login";
import usersRouter from "./controllers/users";
import teambuilderRouter from "./controllers/teambuilder";
import chilemonRouter from "./controllers/chilemon";
import testingRouter from "./controllers/testing";
import battleRouter from "./controllers/battle";
import type { Bindings, Variables } from "./types";
import { ensureBaseData } from "./utils/seed";

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.use("*", logger());
app.use(
  "*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "X-CSRF-Token"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  }),
);

app.use("*", async (c, next) => {
  await ensureBaseData(c.env.DB);
  return next();
});

app.get("/", (c) => c.text("Welcome to Chilemon Showdown API!"));

app.route("/api/login", loginRouter);
app.route("/api/users", usersRouter);

// Teams endpoints available under /api/teams and /api/team/teams
app.route("/api", teambuilderRouter);
app.route("/api/team", teambuilderRouter);

// Chilemon endpoints (keep both /api/chilemon and /chilemon)
app.route("/api/chilemon", chilemonRouter);
app.route("/chilemon", chilemonRouter);

// Battles endpoints accessible at /api/battles and /battles
app.route("/api", battleRouter);
app.route("/", battleRouter);

app.route("/api/testing", testingRouter);

app.notFound((c) => c.json({ error: "unknown endpoint" }, 404));

export default app;
