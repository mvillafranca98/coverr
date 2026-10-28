/**
 * Whether a migration has been applied to this database.
 *
 * Doubles as the health endpoint's database probe: it is a real read against
 * the production database, so an outage throws here rather than passing
 * quietly. `d1_migrations` is wrangler's own bookkeeping table, which is why
 * this is raw SQL and not in the Drizzle schema.
 */
export async function migrationApplied(db: D1Database, name: string): Promise<boolean> {
  const row = await db
    .prepare("SELECT 1 AS applied FROM d1_migrations WHERE name = ?1")
    .bind(name)
    .first();
  return row !== null;
}
