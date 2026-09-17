import { Hono } from "hono";
import type { AdminEnv } from "./context";
import { requireSession, sessionRoutes } from "./session";
import { bandHomeRoutes } from "./band-home";
import { dashboardRoutes } from "./dashboard";
import { ordersRoutes } from "./orders";
import { orderRoutes } from "./order";
import { moneyRoutes } from "./money";
import { eventSettingsRoutes } from "./event-settings";
import { bandSettingsRoutes } from "./band-settings";
import { manualSaleRoutes } from "./manual-sale";

/**
 * The band-facing app, mounted at /admin.
 *
 * `requireSession` is registered first and on every path, because Hono applies
 * middleware in registration order — moving it below the routers would leave
 * them unauthenticated. It exempts the sign-in paths by name rather than by
 * mount order, so that guarantee does not depend on the lines below staying in
 * this sequence.
 */
export const admin = new Hono<AdminEnv>();

admin.use("*", requireSession);

admin.route("/", sessionRoutes);
admin.route("/", bandHomeRoutes);
admin.route("/", dashboardRoutes);
admin.route("/", ordersRoutes);
admin.route("/", orderRoutes);
admin.route("/", moneyRoutes);
admin.route("/", eventSettingsRoutes);
admin.route("/", bandSettingsRoutes);
admin.route("/", manualSaleRoutes);
