import { NextResponse } from "next/server";
import { getSql } from "../../../lib/db";
import { isBlocked, recordFailure } from "../../../lib/security";

export async function POST(request: Request) {
  try {
    if (await isBlocked(request, "player-code", 8)) {
      return NextResponse.json({ error: "Muitas tentativas. Aguarde 15 minutos e tente novamente." }, { status: 429 });
    }
    const body = await request.json();
    const pin = String(body?.pin ?? "").replace(/\D/g, "");
    if (pin.length !== 6) {
      return NextResponse.json({ error: "Digite o código individual de 6 números." }, { status: 400 });
    }

    const sql = getSql();
    const rows = await sql`SELECT player_name FROM player_access WHERE pin = ${pin} LIMIT 1`;
    const voter = rows[0]?.player_name;
    if (!voter) {
      await recordFailure(request, "player-code");
      return NextResponse.json({ error: "Código inválido. Confira os 6 números recebidos." }, { status: 401 });
    }

    return NextResponse.json({ voter });
  } catch {
    return NextResponse.json({ error: "Não foi possível validar o código agora." }, { status: 500 });
  }
}
