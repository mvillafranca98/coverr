import { Hono } from "hono";
import { LandingPage } from "../../views/landing";
import type { PublicEnv } from "./context";

export const landingRoutes = new Hono<PublicEnv>();

/** The front page. Reads nothing and belongs to no band. */
landingRoutes.get("/", (c) => c.html(<LandingPage />));
