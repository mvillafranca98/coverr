import { Hono } from "hono";
import { accountDeletionRoutes } from "./account-deletion";
import { bandHomeRoutes } from "./band-home";
import { bandSettingsRoutes } from "./band-settings";
import { bandsRoutes } from "./bands";
import type { AdminEnv } from "./context";
import { createBandRoutes } from "./create-band";
import { dashboardRoutes } from "./dashboard";
import { doorKitRoutes } from "./door-kit";
import { emailChangeRoutes } from "./email-change";
import { eventSettingsRoutes } from "./event-settings";
import { manualSaleRoutes } from "./manual-sale";
import { moneyRoutes } from "./money";
import { orderRoutes } from "./order";
import { ordersRoutes } from "./orders";
import { requireSession, sessionRoutes } from "./session";
import { unlockRoutes } from "./unlock";

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
admin.route("/", createBandRoutes);
admin.route("/", emailChangeRoutes);
admin.route("/", bandsRoutes);
admin.route("/", bandHomeRoutes);
admin.route("/", dashboardRoutes);
admin.route("/", ordersRoutes);
admin.route("/", orderRoutes);
admin.route("/", moneyRoutes);
admin.route("/", unlockRoutes);
admin.route("/", eventSettingsRoutes);
admin.route("/", bandSettingsRoutes);
admin.route("/", accountDeletionRoutes);
admin.route("/", manualSaleRoutes);
admin.route("/", doorKitRoutes);
