import { NextResponse } from "next/server";
import { getSql } from "../../../lib/db";

const SKILLS = new Set(["levantamento", "passe", "ataque", "saque"]);
const MIN_PLAYERS_RATED = 10;

type Scores = Record<string, number>;
type Ballot = Record<string, Scores>;

function median(values: number[]) {
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
}

// Ajusta o "jeito de dar nota" de cada pessoa. Uma ficha com tudo 5 não eleva ninguém:
// como ela não diferencia jogadores, cada nota vale o centro neutro (3).
function normalizedScores(ballot: Ballot) {
  const values = Object.values(ballot).flatMap((scores) => Object.values(scores));
  if (!values.length) return [] as { player: string; value: number }[];
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  const deviation = Math.sqrt(variance);
  return Object.entries(ballot).flatMap(([player, scores]) => Object.values(scores).map((value) => ({
    player,
    value: deviation < 0.25 ? 3 : Math.max(1, Math.min(5, 3 + (value - mean) / deviation)),
  })));
}

function buildResults(players: string[], ballots: { ratings: Ballot }[]) {
  const received = new Map(players.map((player) => [player, [] as number[]]));
  const coverage = new Map(players.map((player) => [player, 0]));
  for (const row of ballots) {
    const ballot = row.ratings || {};
    for (const player of Object.keys(ballot)) coverage.set(player, (coverage.get(player) ?? 0) + 1);
    for (const rating of normalizedScores(ballot)) received.get(rating.player)?.push(rating.value);
  }
  const ranked = players.map((name) => {
    const values = received.get(name) ?? [];
    return { name, average: values.length ? median(values) : null, votes: coverage.get(name) ?? 0 };
  }).sort((a, b) => (b.average ?? -1) - (a.average ?? -1) || a.name.localeCompare(b.name, "pt-BR"));
  return ranked.map((player, index) => ({ ...player, pot: player.average === null ? null : ["A", "B", "C", "D"][Math.min(3, Math.floor(index / 5))] }));
}

export async function GET() {
  try {
    const sql = getSql();
    const [settings, ballots] = await Promise.all([
      sql`SELECT players FROM app_settings WHERE id = 1`,
      sql`SELECT ratings FROM ballots`,
    ]);
    const players: string[] = settings[0]?.players ?? [];
    // Nunca devolve quem deu qual nota para o navegador público.
    return NextResponse.json({ players, responses: ballots.length, results: buildResults(players, ballots as { ratings: Ballot }[]) });
  } catch {
    return NextResponse.json({ error: "Não foi possível carregar os resultados." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const pin = String(body.pin ?? "").replace(/\D/g, "");
    const ratings = body.ratings && typeof body.ratings === "object" ? body.ratings : {};
    const sql = getSql();
    const settings = await sql`SELECT players FROM app_settings WHERE id = 1`;
    const players: string[] = settings[0]?.players ?? [];
    const access = await sql`SELECT player_name FROM access_codes WHERE pin = ${pin} LIMIT 1`;
    const voter = access[0]?.player_name;
    if (!voter || !players.includes(voter)) return NextResponse.json({ error: "Código individual inválido." }, { status: 403 });
    const previous = await sql`SELECT 1 FROM ballots WHERE voter_name = ${voter}`;
    if (previous.length) return NextResponse.json({ error: "Sua resposta já foi enviada e está bloqueada. Peça ao administrador para liberar uma correção." }, { status: 409 });

    const clean: Ballot = {};
    for (const [player, scores] of Object.entries(ratings)) {
      if (!players.includes(player) || player === voter || !scores || typeof scores !== "object") continue;
      const valid = Object.fromEntries(Object.entries(scores).filter(([skill, score]) => SKILLS.has(skill) && Number.isInteger(score) && Number(score) >= 1 && Number(score) <= 5));
      if (Object.keys(valid).length) clean[player] = valid as Scores;
    }
    if (Object.keys(clean).length < MIN_PLAYERS_RATED) return NextResponse.json({ error: `Avalie pelo menos ${MIN_PLAYERS_RATED} jogadores para enviar.` }, { status: 400 });
    await sql`INSERT INTO ballots (voter_name, ratings, updated_at) VALUES (${voter}, ${JSON.stringify(clean)}::jsonb, NOW())`;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Não foi possível registrar a avaliação." }, { status: 500 });
  }
}
