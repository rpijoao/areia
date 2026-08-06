import { NextResponse } from "next/server";
import { getSql } from "../../../lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const pin = String(body?.pin ?? "").replace(/\D/g, "");
    if (pin.length !== 6) {
      return NextResponse.json({ error: "Digite o código individual de 6 números." }, { status: 400 });
    }

    const sql = getSql();
    const rows = await sql`SELECT player_name FROM player_access WHERE pin = ${pin} LIMIT 1`;
    const voter = rows[0]?.player_name;
    if (!voter) {
      return NextResponse.json({ error: "Código inválido. Confira os 6 números recebidos." }, { status: 401 });
    }

    return NextResponse.json({ voter });
  } catch {
    return NextResponse.json({ error: "Não foi possível validar o código agora." }, { status: 500 });
  }
}
