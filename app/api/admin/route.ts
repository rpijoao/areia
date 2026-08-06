import { NextResponse } from "next/server";
import { getSql } from "../../../lib/db";

function allowed(request: Request) {
  const configured = process.env.ADMIN_PIN;
  return Boolean(configured) && request.headers.get("x-admin-pin") === configured;
}

export async function GET(request: Request) {
  if (!allowed(request)) return NextResponse.json({ error: "Acesso administrativo negado." }, { status: 401 });
  const sql = getSql();
  const [settings, ballots, access] = await Promise.all([
    sql`SELECT players FROM app_settings WHERE id = 1`,
    sql`SELECT voter_name, ratings, updated_at FROM ballots ORDER BY voter_name`,
    sql`SELECT player_name, pin FROM player_access ORDER BY player_name`,
  ]);
  return NextResponse.json({ players: settings[0]?.players ?? [], ballots, access });
}

export async function PUT(request: Request) {
  if (!allowed(request)) return NextResponse.json({ error: "Acesso administrativo negado." }, { status: 401 });
  const body = await request.json();
  const players = Array.isArray(body.players) ? body.players.map((name: unknown) => typeof name === "string" ? name.trim() : "") : [];
  if (players.length !== 20 || players.some((name: string) => !name) || new Set(players.map((name: string) => name.toLocaleLowerCase())).size !== 20) return NextResponse.json({ error: "Informe 20 nomes diferentes." }, { status: 400 });
  const sql = getSql();
  await sql`UPDATE app_settings SET players = ${JSON.stringify(players)}::jsonb, updated_at = NOW() WHERE id = 1`;
  return NextResponse.json({ ok: true });
}

// O Admin pode liberar uma pessoa para corrigir a própria resposta. Isso apaga
// somente a ficha daquela pessoa; ela precisa entrar com o próprio código de novo.
export async function DELETE(request: Request) {
  if (!allowed(request)) return NextResponse.json({ error: "Acesso administrativo negado." }, { status: 401 });
  const body = await request.json();
  const voter = typeof body.voter === "string" ? body.voter.trim() : "";
  if (!voter) return NextResponse.json({ error: "Informe o jogador a liberar." }, { status: 400 });
  const sql = getSql();
  await sql`DELETE FROM ballots WHERE voter_name = ${voter}`;
  return NextResponse.json({ ok: true });
}
