import { Hono } from "hono";
import { operatorAccountRoutes } from "./accounts";
import { operatorBandRoutes } from "./bands";
import type { OperatorEnv } from "./context";
import { operatorFeeRoutes } from "./fees";
import { operatorSessionRoutes, requireOperator } from "./session";

/**
 * Coverr's back office, mounted at /operador.
 *
 * `requireOperator` is registered first and on every path, for the same reason
 * as the band admin's gate: Hono runs middleware in registration order, and a
 * router mounted above it would be served to anyone. It exempts the sign-in
 * paths by name, so that does not depend on the order of the lines below.
 */
export const operator = new Hono<OperatorEnv>();

operator.use("*", requireOperator);

operator.route("/", operatorSessionRoutes);
operator.route("/", operatorBandRoutes);
operator.route("/", operatorFeeRoutes);
operator.route("/", operatorAccountRoutes);
