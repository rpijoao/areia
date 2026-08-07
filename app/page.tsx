"use client";

import { useEffect, useMemo, useState } from "react";

type Skill = "levantamento" | "passe" | "ataque" | "saque";
type SkillScore = Partial<Record<Skill, number>>;
type PlayerResult = { name: string; average: number | null; votes: number; pot: string | null };
type Pair = { a: PlayerResult; b: PlayerResult };
type Team = { players: PlayerResult[]; total: number; capacity: number };

const SKILLS: { key: Skill; label: string; help: string }[] = [
  { key: "levantamento", label: "Levantamento", help: "Passar a bola para o parceiro atacar." },
  { key: "passe", label: "Passe", help: "Receber o saque ou ataque e controlar a bola." },
  { key: "ataque", label: "Ataque", help: "Bater ou colocar a bola na quadra adversária para fazer o ponto." },
  { key: "saque", label: "Saque", help: "Colocar a bola em jogo e dificultar a recepção do adversário." },
];

export default function Home() {
  const [players, setPlayers] = useState<string[]>([]);
  const [results, setResults] = useState<PlayerResult[]>([]);
  const [responses, setResponses] = useState(0);
  const [view, setView] = useState<"votar" | "resultados">("votar");
  const [pin, setPin] = useState("");
  const [voter, setVoter] = useState("");
  const [draft, setDraft] = useState<Record<string, SkillScore>>({});
  const [index, setIndex] = useState(0);
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);

  async function loadState() {
    try {
      const response = await fetch("/api/state", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setPlayers(Array.isArray(data.players) ? data.players : []);
      setResults(Array.isArray(data.results) ? data.results : []);
      setResponses(typeof data.responses === "number" ? data.responses : 0);
    } catch {
      setNotice("Não foi possível carregar os dados agora. Tente novamente.");
    }
  }

  useEffect(() => { void loadState(); }, []);
  useEffect(() => {
    if (voter) localStorage.setItem(`areia:rascunho:${voter}`, JSON.stringify(draft));
  }, [voter, draft]);

  const candidates = useMemo(() => players.filter((name) => name !== voter), [players, voter]);
  const current = candidates[index];
  const ratedCount = Object.values(draft).filter((scores) => Object.keys(scores).length > 0).length;

  async function identifyVoter() {
    if (pin.length !== 6) return setNotice("Digite o código individual de 6 números.");
    setSaving(true);
    try {
      const response = await fetch("/api/access", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Código inválido.");
      const name = String(data.voter || "");
      if (!name) throw new Error("Não foi possível identificar o jogador.");
      setVoter(name);
      const saved = localStorage.getItem(`areia:rascunho:${name}`);
      try { setDraft(saved ? JSON.parse(saved) : {}); } catch { setDraft({}); }
      setIndex(0);
      setNotice("");
      window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível validar o código.");
    } finally { setSaving(false); }
  }

  function setScore(skill: Skill, value?: number) {
    if (!current) return;
    const player = current;
    setDraft((old) => {
      const scores = { ...(old[player] || {}) };
      if (value) scores[skill] = value; else delete scores[skill];
      const next = { ...old };
      if (Object.keys(scores).length) next[player] = scores; else delete next[player];
      return next;
    });
  }

  function skipCurrent() {
    if (!current) return;
    setDraft((old) => { const next = { ...old }; delete next[current]; return next; });
    if (index < candidates.length - 1) {
      setIndex((value) => value + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function nextPlayer() {
    setIndex((value) => Math.min(candidates.length - 1, value + 1));
    setNotice("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit() {
    if (ratedCount < 10) return setNotice(`Avalie pelo menos 10 jogadores. Faltam ${10 - ratedCount}.`);
    setSaving(true);
    try {
      const response = await fetch("/api/state", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin, ratings: draft }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível registrar.");
      localStorage.removeItem(`areia:rascunho:${voter}`);
      setNotice("Avaliação registrada. Obrigado!");
      await loadState();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível salvar a avaliação.");
    } finally { setSaving(false); }
  }

  function drawPairs() {
    const ranked = results.filter((player) => player.average !== null);
    if (ranked.length !== players.length || ranked.some((player) => player.votes < 5)) {
      return setNotice("O sorteio será liberado quando todos receberem pelo menos 5 avaliações.");
    }
    const half = Math.floor(ranked.length / 2);
    const next = ranked.slice(0, half).map((a, position) => ({ a, b: ranked[ranked.length - 1 - position] }));
    setPairs(next.sort(() => Math.random() - 0.5));
    setTeams([]);
    setNotice("");
  }

  function drawTrios() {
    const ranked = results.filter((player) => player.average !== null);
    if (ranked.length !== players.length || ranked.some((player) => player.votes < 5)) {
      return setNotice("O sorteio será liberado quando todos receberem pelo menos 5 avaliações.");
    }
    const groups: Team[] = [3, 3, 3, 3, 3, 3, 2].map((capacity) => ({ players: [], total: 0, capacity }));
    [...ranked].sort((a, b) => (b.average || 0) - (a.average || 0)).forEach((player) => {
      const available = groups.filter((group) => group.players.length < group.capacity).sort((a, b) => a.total - b.total || a.players.length - b.players.length);
      const group = available[0];
      group.players.push(player);
      group.total += player.average || 0;
    });
    setTeams(groups);
    setPairs([]);
    setNotice("");
  }

  return <main id="top">
    <header className="topbar">
      <a className="brand" href="#top"><span className="brand-mark">AE</span><span>Areia <b>Equilibrada</b></span></a>
      <nav aria-label="Navegação principal">
        <button className={view === "votar" ? "active" : ""} onClick={() => setView("votar")}>Avaliar</button>
        <button className={view === "resultados" ? "active" : ""} onClick={() => setView("resultados")}>Resultados</button>
        <a className="admin-link" href="/admin">Admin</a>
      </nav>
    </header>
    {!voter && <section className="hero">
      <div><span className="eyebrow">VÔLEI DE PRAIA · GRUPO</span><h1>Jogo justo.<br /><em>Times equilibrados.</em></h1><p>Cada pessoa avalia os demais por fundamento. As notas em branco são ignoradas.</p></div>
      <div className="hero-score"><div className="ball"><span>{responses}</span><small>de {players.length || 20}</small></div><div><b>Respostas recebidas</b><span>{players.length ? `${Math.max(0, players.length - responses)} participantes faltando` : "Carregando…"}</span></div></div>
    </section>}
    {view === "votar" ? <section className={voter ? "content assessment-content" : "content two-col"}>
      {!voter && <aside className="instruction-card"><span className="step">COMO FUNCIONA</span><h2>Uma pessoa por código.</h2><ol><li><b>Digite seu código</b><span>Ele identifica você; não existe lista de nomes.</span></li><li><b>Avalie por fundamento</b><span>Use 1 a 5 ou deixe em branco quem não conhece.</span></li><li><b>Revise e envie</b><span>Depois do envio, somente o admin pode liberar uma correção.</span></li></ol></aside>}
      <div className="panel">
        {!voter ? <><div className="panel-head"><div><span className="step">PASSO 1</span><h2>Digite seu código</h2></div></div><p>Use os 6 números recebidos pelo WhatsApp. O código não fica salvo neste celular.</p><label className="select-label pin-label">Código individual<input value={pin} inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000" onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))} /></label><button className="primary full" disabled={saving} onClick={identifyVoter}>{saving ? "Validando…" : "Continuar"}</button></> : <>
          <div className="panel-head"><div><span className="step">AVALIAÇÃO</span><h2>Fundamentos do jogador</h2></div><span className="draft-count">{ratedCount}/19 avaliados</span></div>
          <div className="voter-badge"><b>Você está avaliando como:</b> {voter}</div>
          <div className="player-progress"><div><i style={{ width: `${((index + 1) / Math.max(1, candidates.length)) * 100}%` }} /></div><span>Jogador {index + 1} de {candidates.length}</span></div>
          <div className="focus-player"><span>{current?.slice(0, 1)}</span><div><small>JOGADOR SENDO AVALIADO</small><h3>{current}</h3></div></div>
          <div className="rating-guide"><b>1</b> iniciante <span>→</span><b>3</b> intermediário <span>→</span><b>5</b> avançado</div>
          <div className="skill-list">{SKILLS.map((skill) => <div className="skill-row" key={skill.key}><div><b>{skill.label}</b><small>{skill.help}</small></div><div className="score-buttons">{[1, 2, 3, 4, 5].map((score) => <button type="button" key={score} className={current && draft[current]?.[skill.key] === score ? "selected" : ""} onClick={() => setScore(skill.key, score)}>{score}</button>)}<button type="button" className="clear" onClick={() => setScore(skill.key)}>×</button></div></div>)}</div>
          <button className="unknown" type="button" onClick={skipCurrent}>Não conheço bem este jogador — deixar em branco</button>
          <div className="wizard-actions"><button className="secondary" disabled={index === 0 || saving} onClick={() => { setIndex((value) => value - 1); window.scrollTo({ top: 0, behavior: "smooth" }); }}>← Voltar</button>{index < candidates.length - 1 ? <button className="primary" onClick={nextPlayer}>Próximo →</button> : <button className="primary" disabled={saving} onClick={submit}>{saving ? "Salvando…" : "Concluir avaliação"}</button>}</div>
          <p className="privacy">Você pode voltar e corrigir qualquer jogador antes de enviar. Para cada pessoa avaliada, dê nota nos 4 fundamentos. É preciso avaliar pelo menos 10 pessoas.</p>
        </>}
        {notice && <p className={notice.includes("registrada") ? "notice success" : "notice"}>{notice}</p>}
      </div>
    </section> : <section className="content"><div className="section-title"><div><span className="step">RESULTADOS</span><h2>Ranking do grupo</h2><p>As médias ignoram campos em branco. As notas individuais nunca aparecem aqui.</p></div><div><button className="secondary" onClick={drawTrios}>{teams.length ? "Refazer trios" : "Sortear trios"}</button> <button className="primary" onClick={drawPairs}>{pairs.length ? "Refazer duplas" : "Sortear duplas"}</button></div></div>{notice && <p className="notice">{notice}</p>}<div className="results-layout"><div className="ranking"><div className="table-head"><span>#</span><span>Jogador</span><span>Notas</span><span>Média</span><span>Pote</span></div>{results.map((player, position) => <div className="rank-row" key={player.name}><span className="position">{position + 1}</span><span className="rank-name"><i>{player.name.slice(0, 1)}</i>{player.name}</span><span>{player.votes}</span><b>{player.average === null ? "—" : player.average.toFixed(2).replace(".", ",")}</b><span className={`pot pot-${player.pot || "—"}`}>{player.pot || "—"}</span></div>)}</div><aside className="pots"><h3>Potes automáticos</h3>{["A", "B", "C", "D"].map((pot) => <div className={`pot-card pot-card-${pot}`} key={pot}><b>Pote {pot}</b><span>{results.filter((player) => player.pot === pot).map((player) => player.name).join(" · ") || "Aguardando notas"}</span></div>)}</aside></div>{pairs.length > 0 && <div className="draw"><div className="draw-title"><span className="step">SORTEIO EQUILIBRADO</span><h2>Duplas formadas</h2></div><div className="pairs-grid">{pairs.map((pair, position) => <div className="pair-card" key={`${pair.a.name}-${pair.b.name}`}><span>Dupla {String(position + 1).padStart(2, "0")}</span><div><b>{pair.a.name}</b><em>{pair.a.average?.toFixed(2)}</em></div><i>+</i><div><b>{pair.b.name}</b><em>{pair.b.average?.toFixed(2)}</em></div><small>Média: {(((pair.a.average || 0) + (pair.b.average || 0)) / 2).toFixed(2)}</small></div>)}</div></div>}{teams.length > 0 && <div className="draw"><div className="draw-title"><span className="step">SORTEIO EQUILIBRADO</span><h2>Trios formados</h2><p>Com 20 jogadores, serão 6 trios e 1 dupla.</p></div><div className="pairs-grid">{teams.map((team, position) => <div className="pair-card" key={position}><span>{team.players.length === 3 ? "Trio" : "Dupla"} {String(position + 1).padStart(2, "0")}</span>{team.players.map((player) => <div key={player.name}><b>{player.name}</b><em>{player.average?.toFixed(2)}</em></div>)}<small>Média: {(team.total / team.players.length).toFixed(2)}</small></div>)}</div></div>}</section>}
  </main>;
}
