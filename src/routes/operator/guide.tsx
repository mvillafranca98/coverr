import { Hono } from "hono";
import { OperatorGuidePage } from "../../views/operator/guide";
import type { OperatorEnv } from "./context";

export const operatorGuideRoutes = new Hono<OperatorEnv>();

/** How to run the back office, behind the operator sign-in like every page here. */
operatorGuideRoutes.get("/guia", (c) => c.html(<OperatorGuidePage origin={c.env.APP_ORIGIN} />));
