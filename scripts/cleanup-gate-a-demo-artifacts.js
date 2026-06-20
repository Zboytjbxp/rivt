import "dotenv/config";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL?.trim();
const confirm = process.env.CONFIRM_GATE_A_DEMO_CLEANUP === "true";

if (!databaseUrl) throw new Error("DATABASE_URL is required.");
if (!confirm) {
  throw new Error("Set CONFIRM_GATE_A_DEMO_CLEANUP=true to make demo/smoke artifacts non-public.");
}

const pool = new pg.Pool({
  connectionString: databaseUrl,
  ssl: process.env.PGSSL === "disable" || databaseUrl.includes("localhost") ? false : { rejectUnauthorized: false },
});

const patterns = [
  "panel trim-out",
  "rough-in pex",
  "mini-split",
  "stair landing",
  "darius chen",
  "maya ortiz",
  "andre malik",
  "nora walsh",
  "harborline builders",
  "keystone mechanical",
  "bluebeam homes",
  "packet0",
  "smoke test",
  "production smoke",
].map((pattern) => `%${pattern}%`);

const client = await pool.connect();

try {
  await client.query("BEGIN");

  const profiles = await client.query(
    `UPDATE profiles p
     SET visibility = 'private', updated_at = now()
     FROM accounts a
     WHERE a.id = p.account_id
       AND a.status = 'active'
       AND p.visibility = 'network'
       AND lower(concat_ws(' ', p.display_name, p.headline, p.bio, p.location_text)) LIKE ANY($1::text[])
     RETURNING p.account_id::text AS id, p.display_name AS label`,
    [patterns],
  );

  const jobs = await client.query(
    `UPDATE jobs
     SET status = 'closed',
         closed_at = COALESCE(closed_at, now()),
         updated_at = now(),
         version = version + 1
     WHERE status <> 'closed'
       AND lower(concat_ws(' ', title, summary, scope_description)) LIKE ANY($1::text[])
     RETURNING id::text, title AS label`,
    [patterns],
  );

  const organizations = await client.query(
    `UPDATE organizations
     SET status = 'closed', updated_at = now()
     WHERE status = 'active'
       AND lower(name) LIKE ANY($1::text[])
     RETURNING id::text, name AS label`,
    [patterns],
  );

  const reviews = await client.query(
    `UPDATE work_reviews wr
     SET status = 'hidden', updated_at = now()
     FROM accounts a
     INNER JOIN profiles p ON p.account_id = a.id
     WHERE a.id = wr.reviewee_account_id
       AND a.status = 'active'
       AND p.visibility = 'network'
       AND wr.status IN ('approved', 'resolved')
       AND lower(wr.body) LIKE ANY($1::text[])
     RETURNING wr.id::text, left(wr.body, 80) AS label`,
    [patterns],
  );

  await client.query("COMMIT");
  console.log(JSON.stringify({
    ok: true,
    madePrivateProfiles: profiles.rows.length,
    closedJobs: jobs.rows.length,
    closedOrganizations: organizations.rows.length,
    hiddenReviews: reviews.rows.length,
    affected: {
      profiles: profiles.rows,
      jobs: jobs.rows,
      organizations: organizations.rows,
      reviews: reviews.rows,
    },
  }, null, 2));
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  throw error;
} finally {
  client.release();
  await pool.end();
}
