import { NextResponse } from "next/server";
import { getSql } from "../../../lib/db";
import { isBlocked, recordFailure } from "../../../lib/security";

function allowed(request: Request) {
  const configured = process.env.ADMIN_PIN;
  return Boolean(configured) && request.headers.get("x-admin-pin") === configured;
}

async function guard(request: Request) {
  if (await isBlocked(request, "admin", 8)) return NextResponse.json({ error: "Muitas tentativas. Aguarde 15 minutos." }, { status: 429 });
  if (allowed(request)) return null;
  await recordFailure(request, "admin");
  return NextResponse.json({ error: "Acesso administrativo negado." }, { status: 401 });
}

export async function GET(request: Request) {
  const denied = await guard(request);
  if (denied) return denied;
  const sql = getSql();
  const [settings, ballots, access] = await Promise.all([
    sql`SELECT players FROM app_settings WHERE id = 1`,
    sql`SELECT voter_name, updated_at FROM ballots ORDER BY voter_name`,
    sql`SELECT player_name, pin FROM player_access ORDER BY player_name`,
  ]);
  return NextResponse.json({ players: settings[0]?.players ?? [], ballots, access });
}

export async function PUT(request: Request) {
  const denied = await guard(request);
  if (denied) return denied;
  const body = await request.json();
  const players: string[] = Array.isArray(body.players) ? body.players.map((name: unknown): string => typeof name === "string" ? name.trim() : "") : [];
  if (players.length !== 20 || players.some((name: string) => !name) || new Set(players.map((name: string) => name.toLocaleLowerCase())).size !== 20) return NextResponse.json({ error: "Informe 20 nomes diferentes." }, { status: 400 });
  const sql = getSql();
  const [settings, ballots, access] = await Promise.all([
    sql`SELECT players FROM app_settings WHERE id = 1`,
    sql`SELECT 1 FROM ballots LIMIT 1`,
    sql`SELECT pin FROM player_access ORDER BY player_name`,
  ]);
  const previous: string[] = settings[0]?.players ?? [];
  if (ballots.length && JSON.stringify(previous) !== JSON.stringify(players)) return NextResponse.json({ error: "Não altere nomes depois que as avaliações começarem." }, { status: 409 });
  if (!ballots.length && access.length === 20 && JSON.stringify(previous) !== JSON.stringify(players)) {
    await sql.transaction([
      sql`DELETE FROM player_access`,
      ...players.map((player, index) => sql`INSERT INTO player_access (player_name, pin) VALUES (${player}, ${access[index].pin})`),
      sql`UPDATE app_settings SET players = ${JSON.stringify(players)}::jsonb, updated_at = NOW() WHERE id = 1`,
    ]);
  } else {
    await sql`UPDATE app_settings SET players = ${JSON.stringify(players)}::jsonb, updated_at = NOW() WHERE id = 1`;
  }
  return NextResponse.json({ ok: true });
}

// O Admin pode liberar uma pessoa para corrigir a própria resposta. Isso apaga
// somente a ficha daquela pessoa; ela precisa entrar com o próprio código de novo.
export async function DELETE(request: Request) {
  const denied = await guard(request);
  if (denied) return denied;
  const body = await request.json();
  const voter = typeof body.voter === "string" ? body.voter.trim() : "";
  if (!voter) return NextResponse.json({ error: "Informe o jogador a liberar." }, { status: 400 });
  const sql = getSql();
  await sql`DELETE FROM ballots WHERE voter_name = ${voter}`;
  return NextResponse.json({ ok: true });
}
