"use client";

import { useEffect, useMemo, useState } from "react";

type Skill = "levantamento" | "passe" | "ataque" | "saque";
type SkillScore = Partial<Record<Skill, number>>;
type VoteMap = Record<string, Record<string, SkillScore>>;
type Pair = { a: PlayerResult; b: PlayerResult };
type Team = { players: PlayerResult[]; total: number };
type PlayerResult = { name: string; average: number | null; votes: number; pot: string };
type View = "votar" | "jogadores" | "resultados";

const INITIAL_PLAYERS = [
  "Breno", "Cridson", "Cristiano", "Diego Cordeiro", "Diego Sousa", "Gabriela Borges", "Gabrielle", "Italo", "Jenifer", "João Vitor",
  "Junior", "Larissa", "Madson", "Michelly", "Rafaelle", "Ray", "Rud", "Sara", "Selma", "Wendel",
];

const SKILLS: { key: Skill; label: string; help: string }[] = [
  { key: "levantamento", label: "Levantamento", help: "Controle, altura e precisão para o ataque" },
  { key: "passe", label: "Passe", help: "Recepção e domínio da primeira bola" },
  { key: "ataque", label: "Ataque", help: "Força, direção e tomada de decisão" },
  { key: "saque", label: "Saque", help: "Consistência, pressão e direcionamento" },
];

function scoreLabel(score: number) {
  return ["", "Iniciante", "Básico", "Intermediário", "Interm. avançado", "Avançado"][score];
}

export default function Home() {
  const sitePaused = true;

  if (sitePaused) {
    return (
      <main>
        <header className="topbar">
          <a className="brand" href="#top" aria-label="Areia Equilibrada"><span className="brand-mark">AE</span><span>Areia <b>Equilibrada</b></span></a>
        </header>
        <section className="hero" id="top">
          <div>
            <span className="eyebrow">VÔLEI DE PRAIA</span>
            <h1>Site <em>pausado.</em></h1>
            <p>As avaliações e os dados do grupo estão preservados. Voltaremos em breve.</p>
          </div>
          <div className="hero-score" aria-label="Site pausado">
            <div className="ball"><span>⏸</span></div>
            <div><b>Temporariamente pausado</b><span>Obrigado pela compreensão.</span></div>
          </div>
        </section>
        <footer><span>🏐</span><b>Areia Equilibrada</b><p>Feito para o jogo ser bom para todo mundo.</p></footer>
      </main>
    );
  }

  const [players, setPlayers] = useState(INITIAL_PLAYERS);
  const [votes, setVotes] = useState<VoteMap>({});
  const [view, setView] = useState<View>("votar");
  const [voter, setVoter] = useState("");
  const [pin, setPin] = useState("");
  const [draft, setDraft] = useState<Record<string, SkillScore>>({});
  const [playerIndex, setPlayerIndex] = useState(0);
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamMode, setTeamMode] = useState<"duplas" | "trios">("duplas");
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState("");
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/state", { cache: "no-store" }).then(async (response) => {
      if (!response.ok) throw new Error();
      const data = await response.json();
      if (Array.isArray(data.players) && data.players.length === 20) setPlayers(data.players);
      if (data.votes) setVotes(data.votes);
    }).catch(() => setNotice("Não foi possível carregar os dados compartilhados. Tente novamente.")).finally(() => setReady(true));
  }, []);

  // O navegador só guarda a identidade escolhida e o rascunho: nunca o código individual.
  useEffect(() => {
    const savedVoter = localStorage.getItem("areia:voter");
    if (savedVoter) setVoter(savedVoter);
  }, []);

  useEffect(() => {
    if (!voter) return;
    localStorage.setItem("areia:voter", voter);
    localStorage.setItem(`areia:draft:${voter}`, JSON.stringify(draft));
  }, [voter, draft]);

  useEffect(() => {
    if (!ready || !voter) return;
    const saved = localStorage.getItem(`areia:draft:${voter}`);
    if (!saved) return;
    try { setDraft(JSON.parse(saved)); } catch { /* rascunho inválido: segue vazio */ }
  // A restauração acontece somente quando os dados iniciais terminam de carregar.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const results = useMemo<PlayerResult[]>(() => {
    const base = players.map((name) => {
      const received = Object.values(votes).map((ballot) => ballot[name]).filter(Boolean);
      const scores = received.flatMap((rating) => Object.values(rating).filter((v): v is number => typeof v === "number"));
      return { name, average: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null, votes: received.length, pot: "—" };
    }).sort((a, b) => (b.average ?? -1) - (a.average ?? -1) || a.name.localeCompare(b.name));
    return base.map((p, i) => ({ ...p, pot: p.average === null ? "—" : ["A", "B", "C", "D"][Math.min(3, Math.floor(i / 5))] }));
  }, [players, votes]);

  const completed = Object.keys(votes).filter((name) => players.includes(name)).length;
  const ratedInDraft = Object.values(draft).filter((rating) => Object.keys(rating).length > 0).length;
  const candidates = players.filter((name) => name !== voter);
  const currentPlayer = candidates[playerIndex];

  function chooseVoter(name: string) {
    setVoter(name);
    const saved = typeof window !== "undefined" ? localStorage.getItem(`areia:draft:${name}`) : null;
    try { setDraft(saved ? JSON.parse(saved) : (votes[name] ? { ...votes[name] } : {})); } catch { setDraft(votes[name] ? { ...votes[name] } : {}); }
    setPlayerIndex(0);
    setEditing(Boolean(votes[name]));
    setNotice("");
  }

  function setSkill(skill: Skill, score?: number) {
    if (!currentPlayer) return;
    setDraft((old) => {
      const rating = { ...(old[currentPlayer] || {}) };
      if (score) rating[skill] = score; else delete rating[skill];
      const next = { ...old };
      if (Object.keys(rating).length) next[currentPlayer] = rating; else delete next[currentPlayer];
      return next;
    });
  }

  async function saveBallot() {
    if (!voter) return setNotice("Escolha seu nome antes de começar.");
    if (!ratedInDraft) return setNotice("Avalie pelo menos uma pessoa para registrar sua resposta.");
    const clean = { ...draft };
    delete clean[voter];
    setSaving(true);
    try {
      const response = await fetch("/api/state", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ voter, pin, ratings: clean }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setVotes((old) => ({ ...old, [voter]: clean }));
      localStorage.setItem(`areia:draft:${voter}`, JSON.stringify(clean));
      setNotice(editing ? "Avaliação atualizada com sucesso." : "Avaliação registrada com sucesso!");
      setEditing(true);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Não foi possível salvar."); }
    finally { setSaving(false); }
  }

  function updateName(index: number, value: string) {
    setPlayers((old) => old.map((p, i) => i === index ? value : p));
  }

  async function saveNames() {
    const cleaned = players.map((p) => p.trim());
    if (cleaned.some((p) => !p)) return setNotice("Preencha os 20 nomes antes de salvar.");
    if (new Set(cleaned.map((p) => p.toLocaleLowerCase())).size !== 20) return setNotice("Os nomes precisam ser diferentes.");
    setSaving(true);
    try {
      const response = await fetch("/api/state", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ players: cleaned }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setPlayers(cleaned);
      setNotice("Lista de jogadores salva no banco compartilhado.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Não foi possível salvar."); }
    finally { setSaving(false); }
  }

  function drawPairs() {
    const ranked = results.filter((p) => p.average !== null);
    if (ranked.length !== 20) return setNotice("Todos os jogadores precisam receber ao menos uma nota antes do sorteio.");
    const top = ranked.slice(0, 10);
    const bottom = ranked.slice(10).reverse();
    const newPairs = top.map((a, i) => ({ a, b: bottom[i] }));
    for (let i = newPairs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newPairs[i], newPairs[j]] = [newPairs[j], newPairs[i]];
    }
    setPairs(newPairs);
    setTeams([]);
    setNotice("");
  }

  function drawTrios() {
    const ranked = results.filter((p) => p.average !== null);
    if (ranked.length !== 20) return setNotice("Todos os jogadores precisam receber ao menos uma nota antes do sorteio.");
    const groups: Team[] = [3, 3, 3, 3, 3, 3, 2].map((size) => ({ players: [], total: 0, size } as Team & { size: number }));
    for (const player of ranked) {
      const available = groups.filter((group) => group.players.length < (group as Team & { size: number }).size);
      available.sort((a, b) => a.total - b.total || a.players.length - b.players.length)[0].players.push(player);
      const target = available[0];
      target.total += player.average ?? 0;
    }
    setTeams(groups);
    setPairs([]);
    setNotice("");
  }

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Areia Equilibrada, início"><span className="brand-mark">AE</span><span>Areia <b>Equilibrada</b></span></a>
        <nav aria-label="Navegação principal">
          <button className={view === "votar" ? "active" : ""} onClick={() => { setView("votar"); setNotice(""); }}>Avaliar</button>
          <button className={view === "jogadores" ? "active" : ""} onClick={() => { setView("jogadores"); setNotice(""); }}>Jogadores</button>
          <button className={view === "resultados" ? "active" : ""} onClick={() => { setView("resultados"); setNotice(""); }}>Resultados</button>
        </nav>
      </header>

      <section className="hero" id="top">
        <div>
          <span className="eyebrow">VÔLEI DE PRAIA • 20 JOGADORES</span>
          <h1>Times mais justos.<br/><em>Jogo mais divertido.</em></h1>
          <p>Avaliações anônimas entre o grupo ajudam a criar duplas equilibradas — sem achismo e sem panelinha.</p>
        </div>
        <div className="hero-score" aria-label={`${completed} de 20 participantes responderam`}>
          <div className="ball"><span>{completed}</span><small>de 20</small></div>
          <div><b>Respostas recebidas</b><span>{completed === 20 ? "Grupo completo!" : `Faltam ${20 - completed} participantes`}</span></div>
        </div>
      </section>

      <div className="progress-wrap" aria-label={`Progresso: ${completed * 5}%`}><div className="progress"><i style={{ width: `${completed * 5}%` }} /></div><span>{completed * 5}% concluído</span></div>

      {view === "votar" && (
        <section className="content two-col">
          <aside className="instruction-card">
            <span className="step">COMO FUNCIONA</span>
            <h2>Sua opinião conta</h2>
            <ol><li><b>Escolha seu nome</b><span>Você não poderá avaliar a si mesmo.</span></li><li><b>Um jogador por vez</b><span>Avalie levantamento, passe, ataque e saque.</span></li><li><b>Conclua e envie</b><span>Não conhece alguém? Avance deixando em branco.</span></li></ol>
            <div className="privacy">🔒 As notas individuais ficam em sigilo. Só as médias aparecem nos resultados.</div>
          </aside>
          <div className="panel">
            {!ready && <p className="notice success">Carregando avaliações compartilhadas...</p>}
            <div className="panel-head"><div><span className="step">PASSO 1</span><h2>Quem está avaliando?</h2></div>{voter && <span className="draft-count">{ratedInDraft}/19 avaliados</span>}</div>
            <label className="select-label">Escolha seu nome
              <select value={voter} onChange={(e) => chooseVoter(e.target.value)}><option value="">Selecione na lista...</option>{players.map((name) => <option key={name} value={name}>{name}{votes[name] ? " • respondido" : ""}</option>)}</select>
            </label>
            {voter && <label className="select-label pin-label">Seu código individual
              <input value={pin} inputMode="numeric" maxLength={6} placeholder="Digite seus 6 números" onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} />
            </label>}
            {voter ? <>
              <div className="voter-badge"><b>Você está avaliando como:</b> {voter}</div>
              <div className="player-progress"><div><i style={{width:`${((playerIndex + 1) / 19) * 100}%`}} /></div><span>Jogador {playerIndex + 1} de 19</span></div>
              <div className="focus-player"><span>{currentPlayer?.slice(0,1)}</span><div><small>JOGADOR SENDO AVALIADO</small><h3>{currentPlayer}</h3></div></div>
              <div className="rating-guide"><b>1</b> Iniciante <span>→</span> <b>3</b> Intermediário <span>→</span> <b>5</b> Avançado</div>
              <div className="skill-list">{SKILLS.map((skill) => <div className="skill-row" key={skill.key}><div><b>{skill.label}</b><small>{skill.help}</small></div><div className="score-buttons" aria-label={`${skill.label} de ${currentPlayer}`}>{[1,2,3,4,5].map((score) => <button key={score} className={draft[currentPlayer]?.[skill.key] === score ? "selected" : ""} title={scoreLabel(score)} onClick={() => setSkill(skill.key, score)}>{score}</button>)}<button className="clear" aria-label={`Limpar nota de ${skill.label}`} onClick={() => setSkill(skill.key)}>×</button></div></div>)}</div>
              <button className="unknown" onClick={() => setDraft((old) => { const next={...old}; delete next[currentPlayer]; return next; })}>Não conheço bem este jogador — deixar em branco</button>
              <div className="wizard-actions"><button className="secondary" disabled={playerIndex === 0 || saving} onClick={() => setPlayerIndex((i) => Math.max(0,i-1))}>← Corrigir jogador anterior</button>{playerIndex < 18 ? <button className="primary" onClick={() => { setPlayerIndex((i) => Math.min(18,i+1)); setNotice(""); }}>Próximo jogador →</button> : <button className="primary" disabled={saving} onClick={saveBallot}>{saving ? "Salvando..." : editing ? "Atualizar avaliação" : "Concluir e registrar"}</button>}</div>
              <button className="save-partial" disabled={saving || ratedInDraft === 0} onClick={saveBallot}>{saving ? "Salvando..." : `Salvar ${ratedInDraft} avaliação${ratedInDraft === 1 ? "" : "ões"} e atualizar resultados`}</button>
              {notice && <p className={notice.includes("sucesso") || notice.includes("atualizada") ? "notice success" : "notice"}>{notice}</p>}
            </> : <div className="empty"><span>🏐</span><b>Escolha seu nome para começar</b><p>Os outros 19 jogadores aparecerão aqui.</p></div>}
          </div>
        </section>
      )}

      {view === "jogadores" && <section className="content"><div className="section-title"><div><span className="step">CONFIGURAÇÃO</span><h2>Os 20 jogadores</h2><p>Edite a lista antes de iniciar as avaliações. Use nomes diferentes para identificar cada pessoa.</p></div><button className="primary" disabled={saving} onClick={saveNames}>{saving ? "Salvando..." : "Salvar lista"}</button></div><div className="name-grid">{players.map((name, i) => <label key={i}><span>{String(i + 1).padStart(2,"0")}</span><input value={name} maxLength={32} onChange={(e) => updateName(i, e.target.value)} /></label>)}</div>{notice && <p className={notice.includes("salva") ? "notice success" : "notice"}>{notice}</p>}</section>}

      {view === "resultados" && <section className="content"><div className="section-title"><div><span className="step">RESULTADOS</span><h2>Ranking do grupo</h2><p>A média ignora avaliações em branco. “Notas” mostra quantas pessoas avaliaram aquele jogador.</p></div><div><button className={teamMode === "duplas" ? "primary" : "secondary"} onClick={() => { setTeamMode("duplas"); drawPairs(); }}>{pairs.length ? "Refazer duplas" : "Sortear duplas"}</button> <button className={teamMode === "trios" ? "primary" : "secondary"} onClick={() => { setTeamMode("trios"); drawTrios(); }}>{teams.length ? "Refazer trios" : "Sortear trios"}</button></div></div>{notice && <p className="notice">{notice}</p>}<div className="results-layout"><div className="ranking"><div className="table-head"><span>#</span><span>Jogador</span><span>Notas</span><span>Média</span><span>Pote</span></div>{results.map((p, i) => <div className="rank-row" key={p.name}><span className="position">{i + 1}</span><span className="rank-name"><i>{p.name.slice(0,1)}</i>{p.name}</span><span>{p.votes}</span><b>{p.average === null ? "—" : p.average.toFixed(2).replace(".", ",")}</b><span className={`pot pot-${p.pot}`}>{p.pot}</span></div>)}</div><aside className="pots"><h3>Divisão por potes</h3>{["A","B","C","D"].map((pot) => <div className={`pot-card pot-card-${pot}`} key={pot}><b>Pote {pot}</b><span>{results.filter((p) => p.pot === pot).map((p) => p.name).join(" • ") || "Aguardando notas"}</span></div>)}<small>As contagens podem ser diferentes porque é permitido deixar alguém em branco.</small></aside></div>{pairs.length > 0 && <div className="draw"><div className="draw-title"><span className="step">SORTEIO EQUILIBRADO</span><h2>Duplas formadas</h2></div><div className="pairs-grid">{pairs.map((pair, i) => <div className="pair-card" key={i}><span>Dupla {String(i + 1).padStart(2,"0")}</span><div><b>{pair.a.name}</b><em>{pair.a.average?.toFixed(2)}</em></div><i>+</i><div><b>{pair.b.name}</b><em>{pair.b.average?.toFixed(2)}</em></div><small>Média da dupla: {(((pair.a.average ?? 0) + (pair.b.average ?? 0))/2).toFixed(2)}</small></div>)}</div></div>}{teams.length > 0 && <div className="draw"><div className="draw-title"><span className="step">SORTEIO EQUILIBRADO</span><h2>Trios formados</h2><p>São 6 trios e 1 dupla, pois o grupo tem 20 jogadores.</p></div><div className="pairs-grid">{teams.map((team, i) => <div className="pair-card" key={i}><span>{team.players.length === 3 ? "Trio" : "Dupla"} {String(i + 1).padStart(2,"0")}</span>{team.players.map((player) => <div key={player.name}><b>{player.name}</b><em>{player.average?.toFixed(2)}</em></div>)}<small>Média do time: {(team.total / team.players.length).toFixed(2)}</small></div>)}</div></div>}</section>}

      <footer><span>🏐</span><b>Areia Equilibrada</b><p>Feito para o jogo ser bom para todo mundo.</p></footer>
    </main>
  );
}
