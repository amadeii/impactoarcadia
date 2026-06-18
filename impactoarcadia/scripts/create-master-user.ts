import pg from "pg";
import { randomBytes, randomUUID, scrypt } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

type PgClient = pg.PoolClient;

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalEnv(name: string, fallback: string): string {
  const value = process.env[name]?.trim();
  return value || fallback;
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function createUniqueSlug(client: PgClient, baseSlug: string): Promise<string> {
  const normalizedBase = baseSlug
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "arcadia-master";

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const slug = attempt === 0 ? normalizedBase : `${normalizedBase}-${attempt}`;
    const existing = await client.query("SELECT id FROM tenants WHERE slug = $1 LIMIT 1", [slug]);
    if (existing.rowCount === 0) return slug;
  }

  throw new Error("Could not generate a unique tenant slug");
}

async function findOrCreateMasterTenant(
  client: PgClient,
  email: string,
): Promise<{ id: number; created: boolean }> {
  const existing = await client.query(
    "SELECT id FROM tenants WHERE tenant_type = 'master' ORDER BY id ASC LIMIT 1",
  );

  if (existing.rowCount && existing.rows[0]?.id) {
    return { id: Number(existing.rows[0].id), created: false };
  }

  const name = optionalEnv("MASTER_TENANT_NAME", "Arcadia Master");
  const requestedSlug = optionalEnv("MASTER_TENANT_SLUG", "arcadia-master");
  const slug = await createUniqueSlug(client, requestedSlug);
  const features = JSON.stringify({ all: true });

  const created = await client.query(
    `INSERT INTO tenants
      (name, slug, email, plan, status, tenant_type, max_users, features)
     VALUES
      ($1, $2, $3, 'enterprise', 'active', 'master', 999, $4::jsonb)
     RETURNING id`,
    [name, slug, email, features],
  );

  return { id: Number(created.rows[0].id), created: true };
}

async function upsertMasterUser(
  client: PgClient,
  email: string,
  password: string,
): Promise<{ id: string; created: boolean }> {
  const existingUsers = await client.query(
    `SELECT id, username, email
       FROM users
      WHERE lower(username) = lower($1)
         OR lower(email) = lower($1)`,
    [email],
  );

  const matchingIds = new Set(existingUsers.rows.map((row) => row.id));
  if (matchingIds.size > 1) {
    throw new Error(
      `More than one user matches ${email}. Resolve duplicate username/email before running this script.`,
    );
  }

  const hashedPassword = await hashPassword(password);
  const name = optionalEnv("MASTER_USER_NAME", "Administrador Master");

  if (matchingIds.size === 1) {
    const id = [...matchingIds][0] as string;
    await client.query(
      `UPDATE users
          SET username = $1,
              email = $1,
              name = COALESCE(NULLIF(name, ''), $2),
              password = $3,
              role = 'master',
              status = 'active'
        WHERE id = $4`,
      [email, name, hashedPassword, id],
    );
    return { id, created: false };
  }

  const id = randomUUID();
  await client.query(
    `INSERT INTO users
      (id, username, email, name, password, role, status)
     VALUES
      ($1, $2, $2, $3, $4, 'master', 'active')`,
    [id, email, name, hashedPassword],
  );

  return { id, created: true };
}

async function ensureAdminRole(client: PgClient, userId: string): Promise<number> {
  const role = await client.query(
    `INSERT INTO roles (name, description, is_system)
     VALUES ('Administrador', 'Acesso total a todos os modulos', 1)
     ON CONFLICT (name) DO UPDATE
       SET is_system = 1
     RETURNING id`,
  );

  const roleId = Number(role.rows[0].id);
  await client.query(
    `INSERT INTO user_roles (user_id, role_id)
     VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [userId, roleId],
  );

  return roleId;
}

async function ensureTenantOwner(client: PgClient, tenantId: number, userId: string): Promise<void> {
  const membership = await client.query(
    `SELECT id
       FROM tenant_users
      WHERE tenant_id = $1
        AND user_id = $2
      ORDER BY id ASC
      LIMIT 1`,
    [tenantId, userId],
  );

  if (membership.rowCount && membership.rows[0]?.id) {
    await client.query(
      `UPDATE tenant_users
          SET role = 'owner',
              is_owner = 'true'
        WHERE id = $1`,
      [membership.rows[0].id],
    );
    return;
  }

  await client.query(
    `INSERT INTO tenant_users (tenant_id, user_id, role, is_owner)
     VALUES ($1, $2, 'owner', 'true')`,
    [tenantId, userId],
  );
}

async function main() {
  const databaseUrl = requiredEnv("DATABASE_URL");
  const email = requiredEnv("MASTER_USER_EMAIL").toLowerCase();
  const password = requiredEnv("MASTER_USER_PASSWORD");

  if (!email.includes("@")) {
    throw new Error("MASTER_USER_EMAIL must be a valid email-like login");
  }

  if (password.length < 8) {
    throw new Error("MASTER_USER_PASSWORD must contain at least 8 characters");
  }

  const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const tenant = await findOrCreateMasterTenant(client, email);
    const user = await upsertMasterUser(client, email, password);
    const roleId = await ensureAdminRole(client, user.id);
    await ensureTenantOwner(client, tenant.id, user.id);

    await client.query("COMMIT");

    console.log("Master user seed completed successfully.");
    console.log(`User: ${email} (${user.created ? "created" : "updated"})`);
    console.log(`Tenant ID: ${tenant.id} (${tenant.created ? "created" : "existing"})`);
    console.log(`RBAC role ID: ${roleId}`);
    console.log("Tables affected: users, tenants, tenant_users, roles, user_roles.");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Failed to seed master user.");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
