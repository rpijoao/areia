"use client";

import { useEffect, useMemo, useState } from "react";

type Skill = "levantamento" | "passe" | "ataque" | "saque";
type SkillScore = Partial<Record<Skill, number>>;
type PlayerResult = {
  name: string;
  average: number | null;
  votes: number;
  pot: string | null;
  skills: Record<Skill, number | null>;
};
type Pair = { a: PlayerResult; b: PlayerResult };
type Team = { players: PlayerResult[]; total: number; capacity: number };

const SKILLS: { key: Skill; label: string; help: string }[] = [
  {
    key: "levantamento",
    label: "Levantamento",
    help: "Levantar a bola para o ataque do parceiro.",
  },
  {
    key: "passe",
    label: "Passe",
    help: "Receber o saque do adversário e deixar a bola pronta para o levantamento.",
  },
  {
    key: "ataque",
    label: "Ataque",
    help: "Atacar o adversário, seja por cortada, pingo ou batida.",
  },
  {
    key: "saque",
    label: "Saque",
    help: "Sacar a bola com precisão e consistência.",
  },
];

export default function Home() {
  const [players, setPlayers] = useState<string[]>([]);
  const [results, setResults] = useState<PlayerResult[]>([]);
  const [responses, setResponses] = useState(0);
  const [view, setView] = useState<"votar" | "resultados">("votar");
  const [pin, setPin] = useState("");
  const [voter, setVoter] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [draft, setDraft] = useState<Record<string, SkillScore>>({});
  const [skipped, setSkipped] = useState<Record<string, true>>({});
  const [showMissing, setShowMissing] = useState(false);
  const [shake, setShake] = useState(false);
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

  useEffect(() => {
    void loadState();
  }, []);
  useEffect(() => {
    const savedPin = localStorage.getItem("areia:codigo");
    if (!savedPin) return;
    setPin(savedPin);
    void identifyVoter(savedPin, true);
  }, []);
  useEffect(() => {
    if (voter)
      localStorage.setItem(`areia:rascunho:${voter}`, JSON.stringify(draft));
  }, [voter, draft]);

  const candidates = useMemo(
    () => players.filter((name) => name !== voter),
    [players, voter],
  );
  const current = candidates[index];
  const ratedCount = Object.values(draft).filter(
    (scores) => Object.keys(scores).length > 0,
  ).length;
  const currentReady = Boolean(
    current &&
    (skipped[current] ||
      SKILLS.every((skill) => typeof draft[current]?.[skill.key] === "number")),
  );
  const missingSkills =
    current && !skipped[current]
      ? SKILLS.filter(
          (skill) => typeof draft[current]?.[skill.key] !== "number",
        )
      : [];

  async function identifyVoter(savedCode = pin, restoring = false) {
    if (savedCode.length !== 6)
      return setNotice("Digite o código individual de 6 números.");
    setSaving(true);
    try {
      const response = await fetch("/api/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: savedCode }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Código inválido.");
      const name = String(data.voter || "");
      if (!name) throw new Error("Não foi possível identificar o jogador.");
      localStorage.setItem("areia:codigo", savedCode);
      localStorage.setItem("areia:votante", name);
      setVoter(name);
      setSubmitted(Boolean(data.submitted));
      const saved = localStorage.getItem(`areia:rascunho:${name}`);
      try {
        setDraft(saved ? JSON.parse(saved) : {});
      } catch {
        setDraft({});
      }
      setIndex(0);
      setNotice("");
      if (!restoring)
        window.requestAnimationFrame(() =>
          window.scrollTo({ top: 0, behavior: "smooth" }),
        );
    } catch (error) {
      if (error instanceof Error && error.message.includes("Código inválido")) {
        localStorage.removeItem("areia:codigo");
        localStorage.removeItem("areia:votante");
      }
      setNotice(
        error instanceof Error
          ? error.message
          : "Não foi possível validar o código.",
      );
    } finally {
      setSaving(false);
    }
  }

  function setScore(skill: Skill, value?: number) {
    if (!current) return;
    const player = current;
    setSkipped((old) => {
      const next = { ...old };
      delete next[player];
      return next;
    });
    setDraft((old) => {
      const scores = { ...(old[player] || {}) };
      if (value) scores[skill] = value;
      else delete scores[skill];
      const next = { ...old };
      if (Object.keys(scores).length) next[player] = scores;
      else delete next[player];
      return next;
    });
  }

  function skipCurrent() {
    if (!current) return;
    setShowMissing(false);
    setSkipped((old) => ({ ...old, [current]: true }));
    setDraft((old) => {
      const next = { ...old };
      delete next[current];
      return next;
    });
    if (index < candidates.length - 1) {
      setIndex((value) => value + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function nextPlayer() {
    setIndex((value) => Math.min(candidates.length - 1, value + 1));
    setShowMissing(false);
    setNotice("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function previousPlayer() {
    setIndex((value) => Math.max(0, value - 1));
    setShowMissing(false);
    window.requestAnimationFrame(() =>
      window.scrollTo({ top: 0, behavior: "smooth" }),
    );
  }

  function isSkillMissing(skill: Skill) {
    return Boolean(
      showMissing &&
      current &&
      !skipped[current] &&
      typeof draft[current]?.[skill] !== "number",
    );
  }

  function warnAboutMissingSkills() {
    setShowMissing(true);
    setNotice("");
    setShake(false);
    window.requestAnimationFrame(() => {
      setShake(true);
      document
        .querySelector(".missing-skill")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    window.setTimeout(() => setShake(false), 360);
    if (navigator.vibrate) navigator.vibrate(90);
  }

  function tryNextPlayer() {
    if (!currentReady) return warnAboutMissingSkills();
    nextPlayer();
  }

  function trySubmit() {
    if (!currentReady) return warnAboutMissingSkills();
    void submit();
  }

  async function submit() {
    if (ratedCount < 10)
      return setNotice(
        `Avalie pelo menos 10 jogadores. Faltam ${10 - ratedCount}.`,
      );
    setSaving(true);
    try {
      const response = await fetch("/api/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin, ratings: draft }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Não foi possível registrar.");
      localStorage.removeItem(`areia:rascunho:${voter}`);
      setNotice("Avaliação registrada. Obrigado!");
      setSubmitted(true);
      await loadState();
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar a avaliação.",
      );
    } finally {
      setSaving(false);
    }
  }

  function drawPairs() {
    const ranked = results.filter((player) => player.average !== null);
    if (
      ranked.length !== players.length ||
      ranked.some((player) => player.votes < 5)
    ) {
      return setNotice(
        "O sorteio será liberado quando todos receberem pelo menos 5 avaliações.",
      );
    }
    const half = Math.floor(ranked.length / 2);
    const next = ranked
      .slice(0, half)
      .map((a, position) => ({ a, b: ranked[ranked.length - 1 - position] }));
    setPairs(next.sort(() => Math.random() - 0.5));
    setTeams([]);
    setNotice("");
  }

  function drawTrios() {
    const ranked = results.filter((player) => player.average !== null);
    if (
      ranked.length !== players.length ||
      ranked.some((player) => player.votes < 5)
    ) {
      return setNotice(
        "O sorteio será liberado quando todos receberem pelo menos 5 avaliações.",
      );
    }
    const groups: Team[] = [3, 3, 3, 3, 3, 3, 2].map((capacity) => ({
      players: [],
      total: 0,
      capacity,
    }));
    [...ranked]
      .sort((a, b) => (b.average || 0) - (a.average || 0))
      .forEach((player) => {
        const available = groups
          .filter((group) => group.players.length < group.capacity)
          .sort(
            (a, b) => a.total - b.total || a.players.length - b.players.length,
          );
        const group = available[0];
        group.players.push(player);
        group.total += player.average || 0;
      });
    setTeams(groups);
    setPairs([]);
    setNotice("");
  }

  if (voter && submitted && view === "votar")
    return (
      <main id="top">
        <header className="topbar">
          <a className="brand" href="#top">
            <span className="brand-mark">AE</span>
            <span>
              Areia <b>Equilibrada</b>
            </span>
          </a>
          <nav aria-label="Navegação principal">
            <button className="active">Avaliar</button>
            <button onClick={() => setView("resultados")}>Resultados</button>
            <a className="admin-link" href="/admin">
              Admin
            </a>
          </nav>
        </header>
        <section className="content assessment-content">
          <div className="panel completed-panel">
            <span className="step">AVALIAÇÃO CONCLUÍDA</span>
            <h2>Resposta já enviada</h2>
            <p>
              Sua avaliação está registrada e bloqueada. Se precisar corrigir
              algo, peça ao administrador para liberar sua resposta.
            </p>
            <button className="primary" onClick={() => setView("resultados")}>
              Ver resultados
            </button>
          </div>
        </section>
      </main>
    );

  return (
    <main id="top">
      <header className="topbar">
        <a className="brand" href="#top">
          <span className="brand-mark">AE</span>
          <span>
            Areia <b>Equilibrada</b>
          </span>
        </a>
        <nav aria-label="Navegação principal">
          <button
            className={view === "votar" ? "active" : ""}
            onClick={() => setView("votar")}
          >
            Avaliar
          </button>
          <button
            className={view === "resultados" ? "active" : ""}
            onClick={() => setView("resultados")}
          >
            Resultados
          </button>
          <a className="admin-link" href="/admin">
            Admin
          </a>
        </nav>
      </header>
      {!voter && view === "votar" && (
        <section className="hero">
          <div>
            <span className="eyebrow">VÔLEI DE PRAIA · GRUPO</span>
            <h1>
              Jogo justo.
              <br />
              <em>Times equilibrados.</em>
            </h1>
            <p>
              Cada pessoa avalia os demais por fundamento. As notas em branco
              são ignoradas.
            </p>
          </div>
          <div className="hero-score">
            <div className="ball">
              <span>{responses}</span>
              <small>de {players.length || 20}</small>
            </div>
            <div>
              <b>Respostas recebidas</b>
              <span>
                {players.length
                  ? `${Math.max(0, players.length - responses)} participantes faltando`
                  : "Carregando…"}
              </span>
            </div>
          </div>
        </section>
      )}
      {view === "votar" ? (
        <section
          className={voter ? "content assessment-content" : "content two-col"}
        >
          {!voter && (
            <aside className="instruction-card">
              <span className="step">COMO FUNCIONA</span>
              <h2>Uma pessoa por código.</h2>
              <ol>
                <li>
                  <b>Digite seu código</b>
                  <span>Ele identifica você; não existe lista de nomes.</span>
                </li>
                <li>
                  <b>Avalie por fundamento</b>
                  <span>Use 1 a 5 ou deixe em branco quem não conhece.</span>
                </li>
                <li>
                  <b>Revise e envie</b>
                  <span>
                    Depois do envio, somente o admin pode liberar uma correção.
                  </span>
                </li>
              </ol>
            </aside>
          )}
          <div className={shake ? "panel validation-shake" : "panel"}>
            {!voter ? (
              <>
                <div className="panel-head">
                  <div>
                    <span className="step">PASSO 1</span>
                    <h2>Digite seu código</h2>
                  </div>
                </div>
                <p>
                  Use os 6 números recebidos pelo WhatsApp. O código fica salvo
                  neste celular.
                </p>
                <label className="select-label pin-label">
                  Código individual
                  <input
                    value={pin}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="000000"
                    onChange={(event) =>
                      setPin(event.target.value.replace(/\D/g, ""))
                    }
                  />
                </label>
                <button
                  className="primary full"
                  disabled={saving}
                  onClick={() => void identifyVoter()}
                >
                  {saving ? "Validando…" : "Continuar"}
                </button>
              </>
            ) : (
              <>
                <div className="panel-head">
                  <div>
                    <span className="step">AVALIAÇÃO</span>
                    <h2 className="assessment-title">Avaliar {current}</h2>
                    <p className="assessment-meta">
                      Você: <b>{voter}</b> · Jogador {index + 1} de{" "}
                      {candidates.length}
                    </p>
                  </div>
                  <span className="draft-count">{ratedCount}/19</span>
                </div>
                <div className="player-progress compact-progress">
                  <div>
                    <i
                      style={{
                        width: `${((index + 1) / Math.max(1, candidates.length)) * 100}%`,
                      }}
                    />
                  </div>
                </div>
                <div className="rating-guide">
                  <span className="guide-level">
                    <b>1</b> Iniciante
                  </span>
                  <i className="guide-arrow">→</i>
                  <span className="guide-level">
                    <b>3</b> Intermediário
                  </span>
                  <i className="guide-arrow">→</i>
                  <span className="guide-level">
                    <b>5</b> Avançado
                  </span>
                </div>
                <div className="skill-list">
                  {SKILLS.map((skill) => (
                    <div
                      className={
                        isSkillMissing(skill.key)
                          ? "skill-row missing-skill"
                          : "skill-row"
                      }
                      key={skill.key}
                    >
                      <div>
                        <b>{skill.label}</b>
                        <small>{skill.help}</small>
                      </div>
                      <div className="score-buttons">
                        {[1, 2, 3, 4, 5].map((score) => (
                          <button
                            type="button"
                            key={score}
                            className={
                              current && draft[current]?.[skill.key] === score
                                ? "selected"
                                : ""
                            }
                            onClick={() => setScore(skill.key, score)}
                          >
                            {score}
                          </button>
                        ))}
                        <button
                          type="button"
                          className="clear"
                          onClick={() => setScore(skill.key)}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <button className="unknown" type="button" onClick={skipCurrent}>
                  Não conheço bem este jogador — deixar em branco
                </button>
                <div className="wizard-actions">
                  <button
                    className="secondary"
                    disabled={index === 0 || saving}
                    onClick={previousPlayer}
                  >
                    ← Voltar
                  </button>
                  {index < candidates.length - 1 ? (
                    <button className="primary" onClick={tryNextPlayer}>
                      Próximo →
                    </button>
                  ) : (
                    <button
                      className="primary"
                      disabled={saving}
                      onClick={trySubmit}
                    >
                      {saving ? "Salvando…" : "Concluir avaliação"}
                    </button>
                  )}
                </div>
                <p className="privacy">
                  Você pode voltar e corrigir qualquer jogador antes de enviar.
                  Para cada pessoa avaliada, dê nota nos 4 fundamentos. É
                  preciso avaliar pelo menos 10 pessoas.
                </p>
              </>
            )}
            {notice && (
              <p
                className={
                  notice.includes("registrada") ? "notice success" : "notice"
                }
              >
                {notice}
              </p>
            )}
          </div>
        </section>
      ) : (
        <section className="content">
          <div className="section-title results-header">
            <div>
              <span className="step">RESULTADOS</span>
              <h2>Ranking do grupo</h2>
              <p>
                As médias ignoram campos em branco. As notas individuais nunca
                aparecem aqui.
              </p>
            </div>
            <div className="draw-actions">
              <button className="secondary" onClick={drawTrios}>
                {teams.length ? "Refazer trios" : "Sortear trios"}
              </button>
              <button className="primary" onClick={drawPairs}>
                {pairs.length ? "Refazer duplas" : "Sortear duplas"}
              </button>
            </div>
          </div>
          {notice && <p className="notice">{notice}</p>}
          <div className="results-layout">
            <div className="ranking">
              <div className="table-head">
                <span>#</span>
                <span>Jogador</span>
                <span>Aval.</span>
                <span>Média</span>
                <span>Pote</span>
              </div>
              {results.map((player, position) => (
                <details className="rank-item" key={player.name}>
                  <summary className="rank-summary">
                    <div className="rank-row">
                      <span className="position">{position + 1}</span>
                      <span className="rank-name">
                        <i>{player.name.slice(0, 1)}</i>
                        {player.name}
                      </span>
                      <span>{player.votes}</span>
                      <b>
                        {player.average === null
                          ? "—"
                          : player.average.toFixed(2).replace(".", ",")}
                      </b>
                      <span className={`pot pot-${player.pot || "—"}`}>
                        {player.pot || "—"}
                      </span>
                    </div>
                  </summary>
                  <div className="skill-breakdown">
                    {SKILLS.map((skill) => (
                      <div key={skill.key}>
                        <span>{skill.label}</span>
                        <b>
                          {player.skills[skill.key] === null
                            ? "—"
                            : player.skills[skill.key]
                                ?.toFixed(1)
                                .replace(".", ",")}
                        </b>
                      </div>
                    ))}
                  </div>
                </details>
              ))}
            </div>
            <aside className="pots">
              <h3>Potes automáticos</h3>
              {["A", "B", "C", "D"].map((pot) => (
                <div className={`pot-card pot-card-${pot}`} key={pot}>
                  <b>Pote {pot}</b>
                  <span>
                    {results
                      .filter((player) => player.pot === pot)
                      .map((player) => player.name)
                      .join(" · ") || "Aguardando notas"}
                  </span>
                </div>
              ))}
            </aside>
          </div>
          {pairs.length > 0 && (
            <div className="draw">
              <div className="draw-title">
                <span className="step">SORTEIO EQUILIBRADO</span>
                <h2>Duplas formadas</h2>
              </div>
              <div className="pairs-grid">
                {pairs.map((pair, position) => (
                  <div
                    className="pair-card"
                    key={`${pair.a.name}-${pair.b.name}`}
                  >
                    <span>Dupla {String(position + 1).padStart(2, "0")}</span>
                    <div>
                      <b>{pair.a.name}</b>
                      <em>{pair.a.average?.toFixed(2)}</em>
                    </div>
                    <i>+</i>
                    <div>
                      <b>{pair.b.name}</b>
                      <em>{pair.b.average?.toFixed(2)}</em>
                    </div>
                    <small>
                      Média:{" "}
                      {(
                        ((pair.a.average || 0) + (pair.b.average || 0)) /
                        2
                      ).toFixed(2)}
                    </small>
                  </div>
                ))}
              </div>
            </div>
          )}
          {teams.length > 0 && (
            <div className="draw">
              <div className="draw-title">
                <span className="step">SORTEIO EQUILIBRADO</span>
                <h2>Trios formados</h2>
                <p>Com 20 jogadores, serão 6 trios e 1 dupla.</p>
              </div>
              <div className="pairs-grid">
                {teams.map((team, position) => (
                  <div className="pair-card" key={position}>
                    <span>
                      {team.players.length === 3 ? "Trio" : "Dupla"}{" "}
                      {String(position + 1).padStart(2, "0")}
                    </span>
                    {team.players.map((player) => (
                      <div key={player.name}>
                        <b>{player.name}</b>
                        <em>{player.average?.toFixed(2)}</em>
                      </div>
                    ))}
                    <small>
                      Média: {(team.total / team.players.length).toFixed(2)}
                    </small>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
