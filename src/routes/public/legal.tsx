import { Hono } from "hono";
import { PrivacyPage } from "../../views/legal/privacy";
import { TermsPage } from "../../views/legal/terms";
import type { PublicEnv } from "./context";

export const legalRoutes = new Hono<PublicEnv>();

/**
 * The two legal documents. They read nothing, belong to no band and are the
 * only buyer-surface pages meant to be found in a search result — a policy
 * nobody can reach is not published.
 */
legalRoutes.get("/privacidad", (c) => c.html(<PrivacyPage origin={c.env.APP_ORIGIN} />));
legalRoutes.get("/terminos", (c) => c.html(<TermsPage origin={c.env.APP_ORIGIN} />));
