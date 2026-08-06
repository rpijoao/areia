import { NextResponse } from "next/server";
import { getSql } from "../../../lib/db";

const SKILLS = new Set(["levantamento", "passe", "ataque", "saque"]);

export async function GET() {
  try {
    const sql = getSql();
    const [settings, ballots] = await Promise.all([sql`SELECT players FROM app_settings WHERE id = 1`, sql`SELECT voter_name, ratings FROM ballots ORDER BY voter_name`]);
    return NextResponse.json({ players: settings[0]?.players ?? [], votes: Object.fromEntries(ballots.map((row) => [row.voter_name, row.ratings])) });
  } catch (error) {
    console.error("state GET failed", error);
    return NextResponse.json({ error: "Não foi possível carregar as avaliações." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const voter = typeof body.voter === "string" ? body.voter.trim() : "";
    const pin = typeof body.pin === "string" ? body.pin.trim() : "";
    const ratings = body.ratings && typeof body.ratings === "object" ? body.ratings : {};
    const sql = getSql();
    const settings = await sql`SELECT players FROM app_settings WHERE id = 1`;
    const players: string[] = settings[0]?.players ?? [];
    if (!players.includes(voter)) return NextResponse.json({ error: "Participante inválido." }, { status: 400 });
    const access = await sql`SELECT 1 FROM player_access WHERE player_name = ${voter} AND pin = ${pin}`;
    if (!access.length) return NextResponse.json({ error: "Código individual inválido." }, { status: 403 });
    const clean: Record<string, Record<string, number>> = {};
    for (const [player, scores] of Object.entries(ratings)) {
      if (!players.includes(player) || player === voter || !scores || typeof scores !== "object") continue;
      const valid = Object.fromEntries(Object.entries(scores).filter(([skill, score]) => SKILLS.has(skill) && Number.isInteger(score) && Number(score) >= 1 && Number(score) <= 5));
      if (Object.keys(valid).length) clean[player] = valid as Record<string, number>;
    }
    if (!Object.keys(clean).length) return NextResponse.json({ error: "Avalie pelo menos uma pessoa." }, { status: 400 });
    await sql`INSERT INTO ballots (voter_name, ratings, updated_at) VALUES (${voter}, ${JSON.stringify(clean)}::jsonb, NOW()) ON CONFLICT (voter_name) DO UPDATE SET ratings = EXCLUDED.ratings, updated_at = NOW()`;
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: "Não foi possível registrar a avaliação." }, { status: 500 }); }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const players = Array.isArray(body.players) ? body.players.map((name: unknown) => typeof name === "string" ? name.trim() : "") : [];
    if (players.length !== 20 || players.some((name: string) => !name) || new Set(players.map((name: string) => name.toLocaleLowerCase())).size !== 20) return NextResponse.json({ error: "Informe 20 nomes diferentes." }, { status: 400 });
    const sql = getSql();
    await sql`UPDATE app_settings SET players = ${JSON.stringify(players)}::jsonb, updated_at = NOW() WHERE id = 1`;
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: "Não foi possível salvar os nomes." }, { status: 500 }); }
}
