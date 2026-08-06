"use client";

import { useState } from "react";

type AdminData = {
  players: string[];
  ballots: { voter_name: string; updated_at: string }[];
  access: { player_name: string; pin: string }[];
};

export default function AdminPage() {
  const [pin, setPin] = useState("");
  const [data, setData] = useState<AdminData | null>(null);
  const [notice, setNotice] = useState("");

  async function enter() {
    const response = await fetch("/api/admin", { headers: { "x-admin-pin": pin } });
    const body = await response.json();
    if (!response.ok) return setNotice(body.error || "Senha inválida.");
    setData(body);
    setNotice("");
  }

  async function release(voter: string) {
    const response = await fetch("/api/admin", { method: "DELETE", headers: { "Content-Type": "application/json", "x-admin-pin": pin }, body: JSON.stringify({ voter }) });
    if (!response.ok) return setNotice("Não foi possível liberar a resposta.");
    setData((old) => old ? { ...old, ballots: old.ballots.filter((ballot) => ballot.voter_name !== voter) } : old);
    setNotice(`${voter} foi liberado para corrigir a resposta.`);
  }

  async function savePlayers() {
    if (!data) return;
    const response = await fetch("/api/admin", { method: "PUT", headers: { "Content-Type": "application/json", "x-admin-pin": pin }, body: JSON.stringify({ players: data.players }) });
    const body = await response.json();
    setNotice(response.ok ? "Lista de jogadores atualizada." : (body.error || "Não foi possível salvar a lista."));
  }

  return <main><header className="topbar"><a className="brand" href="/"><span className="brand-mark">AE</span><span>Areia <b>Equilibrada</b></span></a><a href="/">Voltar</a></header><section className="content"><div className="panel"><span className="step">ÁREA RESTRITA</span><h1>Painel Admin</h1>{!data ? <><label className="select-label">Senha do administrador<input type="password" value={pin} onChange={(event) => setPin(event.target.value)} placeholder="Digite a senha" /></label><button className="primary" onClick={enter}>Entrar</button></> : <><p className="notice success">{data.ballots.length} resposta(s) bloqueada(s). As notas individuais não são exibidas.</p><div className="section-title"><div><span className="step">JOGADORES</span><h2>Lista oficial</h2></div><button className="primary" onClick={savePlayers}>Salvar lista</button></div><div className="name-grid">{data.players.map((player, index) => <label key={index}><span>{String(index + 1).padStart(2, "0")}</span><input value={player} onChange={(event) => setData((old) => old ? { ...old, players: old.players.map((name, position) => position === index ? event.target.value : name) } : old)} /></label>)}</div><div className="results-layout"><div className="ranking"><div className="table-head"><span>#</span><span>Jogador</span><span>Código</span><span></span><span></span></div>{data.access.map((item, index) => <div className="rank-row" key={item.player_name}><span>{index + 1}</span><span>{item.player_name}</span><b>{item.pin}</b><span></span><span></span></div>)}</div><aside className="pots"><h3>Respostas</h3>{data.ballots.length ? data.ballots.map((ballot) => <p key={ballot.voter_name}><b>{ballot.voter_name}</b><br/><button className="secondary" onClick={() => release(ballot.voter_name)}>Liberar correção</button></p>) : <p>Nenhuma resposta enviada.</p>}</aside></div></>}{notice && <p className="notice">{notice}</p>}</div></section></main>;
}
