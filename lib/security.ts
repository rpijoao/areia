import { getSql } from "./db";

const WINDOW_MINUTES = 15;

function clientAddress(request: Request) {
  return request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || "unknown";
}

async function prepareLimits() {
  const sql = getSql();
  await sql`CREATE TABLE IF NOT EXISTS request_limits (key text PRIMARY KEY, attempts integer NOT NULL DEFAULT 0, expires_at timestamptz NOT NULL)`;
  await sql`DELETE FROM request_limits WHERE expires_at < NOW()`;
  return sql;
}

function keyFor(request: Request, scope: string) {
  return `${scope}:${clientAddress(request)}`;
}

// Apenas falhas contam. Assim, vários jogadores na mesma rede podem entrar
// normalmente, sem esgotar o limite uns dos outros.
export async function isBlocked(request: Request, scope: string, maximum: number) {
  const sql = await prepareLimits();
  const key = keyFor(request, scope);
  const rows = await sql`SELECT attempts FROM request_limits WHERE key = ${key} AND expires_at >= NOW()`;
  return Number(rows[0]?.attempts ?? 0) >= maximum;
}

export async function recordFailure(request: Request, scope: string) {
  const sql = await prepareLimits();
  const key = keyFor(request, scope);
  await sql`
    INSERT INTO request_limits (key, attempts, expires_at)
    VALUES (${key}, 1, NOW() + (${WINDOW_MINUTES} * INTERVAL '1 minute'))
    ON CONFLICT (key) DO UPDATE SET
      attempts = request_limits.attempts + 1,
      expires_at = NOW() + (${WINDOW_MINUTES} * INTERVAL '1 minute')
  `;
}
