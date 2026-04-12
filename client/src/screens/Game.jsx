import { useState } from 'react';
import socket from '../socket';
import Card, { CHAR_CONFIG } from '../components/Card';
import GameLog from '../components/GameLog';
import styles from './Game.module.css';

const ACTION_NAMES = {
  renda: 'Renda',
  ajuda_externa: 'Ajuda Externa',
  golpe: 'Golpe',
  taxar: 'Taxar',
  roubar: 'Roubar',
  assassinar: 'Assassinar',
  investigar: 'Investigar',
};

const ACTIONS_NEEDING_TARGET = ['golpe', 'roubar', 'assassinar', 'investigar'];

const BLOCK_OPTIONS = {
  ajuda_externa: ['politico'],
  roubar: ['juiz', 'guarda_costas'],
  assassinar: ['guarda_costas'],
  investigar: ['juiz'],
};

export default function Game({ data, myId }) {
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [selectedCardIndex, setSelectedCardIndex] = useState(null);
  const [blockChar, setBlockChar] = useState(null);
  const [error, setError] = useState('');
  const [showHelp, setShowHelp] = useState(false);

  if (!data?.game) return <div className={styles.loading}>Carregando...</div>;

  const { game } = data;
  const { players, currentPlayerId, phase, pendingAction: pa, log, winner } = game;
  const me = players.find(p => p.id === myId);
  const others = players.filter(p => p.id !== myId);
  const isMyTurn = currentPlayerId === myId;

  function emit(event, payload, cb) {
    setError('');
    socket.emit(event, payload, res => {
      if (res && !res.success) setError(res.error || 'Erro');
      cb?.();
    });
  }

  function takeAction(action) {
    if (ACTIONS_NEEDING_TARGET.includes(action) && !selectedTarget) {
      setError('Selecione um oponente como alvo primeiro');
      return;
    }
    emit('take_action', { action, targetId: selectedTarget }, () => setSelectedTarget(null));
  }

  function handlePass() { emit('pass', {}); }
  function handleChallenge() { emit('challenge', {}); }
  function handleBlock() {
    if (!blockChar) return setError('Escolha o personagem para bloquear');
    emit('block', { character: blockChar }, () => setBlockChar(null));
  }
  function handleLoseInfluence() {
    if (selectedCardIndex === null) return setError('Selecione uma carta para perder');
    emit('lose_influence', { cardIndex: selectedCardIndex }, () => setSelectedCardIndex(null));
  }
  function handleInvestigateDecision(forceSwap) {
    emit('investigate_decision', { forceSwap });
  }

  const iAmActor = pa?.actorId === myId;
  const iAmTarget = pa?.targetId === myId;
  const alreadyResponded = pa?.respondedPlayers?.includes(myId);
  const iAmInLoseQueue = pa?.loseInfluenceQueue?.[0]?.playerId === myId;

  const canAct = isMyTurn && phase === 'ACTION_SELECT' && me?.alive;
  const canRespond = phase === 'RESPONSE_WINDOW' && !iAmActor && !alreadyResponded && me?.alive;
  const canChallengeAction = canRespond && !!pa?.claimedCharacter;
  const canBlockAction = canRespond && (() => {
    if (!pa) return false;
    if (pa.type === 'ajuda_externa') return true;
    return iAmTarget;
  })();
  const canChallengeBlock = phase === 'BLOCK_CHALLENGE_WINDOW' && iAmActor;
  const mustLoseInfluence = phase === 'LOSE_INFLUENCE' && iAmInLoseQueue;
  const mustInvestigateDecide = phase === 'INVESTIGATE_DECISION' && iAmActor;
  const blockOptions = pa ? (BLOCK_OPTIONS[pa.type] || []) : [];

  const actorName = pa ? players.find(p => p.id === pa.actorId)?.name : null;
  const targetName = pa?.targetId ? players.find(p => p.id === pa.targetId)?.name : null;
  const blockerName = pa?.blocker ? players.find(p => p.id === pa.blocker.playerId)?.name : null;

  if (winner) {
    const winnerPlayer = players.find(p => p.id === winner);
    return (
      <div className={styles.gameOver}>
        <div className={styles.gameOverCard}>
          <h1>FIM DE JOGO</h1>
          <p className={styles.winnerName}>{winnerPlayer?.name} venceu!</p>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>Jogar Novamente</button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.board}>

      {/* ── TOP BAR: opponents + help ── */}
      <div className={styles.topBar}>
        <div className={styles.opponents}>
          {others.map(p => (
            <div
              key={p.id}
              className={`
                ${styles.opponent}
                ${p.id === currentPlayerId ? styles.opponentActive : ''}
                ${!p.alive ? styles.opponentDead : ''}
                ${selectedTarget === p.id ? styles.opponentTargeted : ''}
                ${canAct && p.alive && ACTIONS_NEEDING_TARGET.length ? styles.opponentClickable : ''}
              `}
              onClick={() => {
                if (canAct && p.alive) setSelectedTarget(prev => prev === p.id ? null : p.id);
              }}
            >
              <div className={styles.opponentAvatar}>
                {p.name.charAt(0).toUpperCase()}
              </div>
              <div className={styles.opponentInfo}>
                <span className={styles.opponentName}>{p.name}</span>
                <span className={styles.opponentCoins}>💰 {p.coins}</span>
              </div>
              <div className={styles.opponentCardBacks}>
                {p.cards.map((c, i) => (
                  <div key={i} className={`${styles.miniCard} ${c.dead ? styles.miniCardDead : ''}`}>
                    {c.dead ? '✕' : c.character
                      ? <span title={CHAR_CONFIG[c.character]?.label}>{CHAR_CONFIG[c.character]?.icon}</span>
                      : '🃏'
                    }
                  </div>
                ))}
              </div>
              {p.id === currentPlayerId && <div className={styles.turnIndicator}>VEZ</div>}
              {selectedTarget === p.id && <div className={styles.targetIndicator}>ALVO</div>}
            </div>
          ))}
        </div>
        <button className={styles.helpBtn} onClick={() => setShowHelp(h => !h)}>
          ? Ajuda
        </button>
      </div>

      {/* ── MAIN AREA ── */}
      <div className={styles.main}>

        {/* LEFT: log + deck + coins */}
        <div className={styles.leftPanel}>
          <div className={styles.logTitle}>Chat da Rodada</div>
          <GameLog log={log} />
          <div className={styles.deckInfo}>
            <div className={styles.deckStack}>
              <div className={styles.deckCard} />
              <div className={styles.deckCard} />
              <div className={styles.deckCard} />
            </div>
            <span>Compras</span>
          </div>
          <div className={styles.coinsInfo}>
            {[...Array(Math.min(me?.coins || 0, 10))].map((_, i) => (
              <span key={i} className={styles.coin}>●</span>
            ))}
            <span className={styles.coinCount}>{me?.coins} moedas</span>
          </div>
        </div>

        {/* CENTER: mesa + my cards */}
        <div className={styles.centerPanel}>
          {/* Mesa */}
          <div className={styles.mesaWrapper}>
            <div className={styles.mesa}>
              {phase === 'ACTION_SELECT' && (
                isMyTurn
                  ? <div className={styles.mesaMyTurn}><span>SUA VEZ</span><p>Escolha uma ação no menu →</p></div>
                  : <div className={styles.mesaWaiting}><span>{players.find(p => p.id === currentPlayerId)?.name}</span><p>está escolhendo...</p></div>
              )}
              {(phase === 'RESPONSE_WINDOW' || phase === 'BLOCK_CHALLENGE_WINDOW') && pa && (
                <div className={styles.mesaAction}>
                  <div className={styles.mesaActionIcon}>{pa.claimedCharacter ? CHAR_CONFIG[pa.claimedCharacter]?.icon : '⚡'}</div>
                  <div className={styles.mesaActionName}>{ACTION_NAMES[pa.type]}</div>
                  <div className={styles.mesaActionPlayers}>
                    <span className={styles.mesaActor}>{actorName}</span>
                    {targetName && <><span className={styles.mesaArrow}>→</span><span className={styles.mesaTarget}>{targetName}</span></>}
                  </div>
                  {phase === 'BLOCK_CHALLENGE_WINDOW' && pa.blocker && (
                    <div className={styles.mesaBlock}>
                      🛡️ {blockerName} bloqueia como {CHAR_CONFIG[pa.blocker.character]?.label}
                    </div>
                  )}
                  {phase === 'RESPONSE_WINDOW' && (
                    <div className={styles.mesaWaiting}><p>Aguardando respostas...</p></div>
                  )}
                </div>
              )}
              {phase === 'LOSE_INFLUENCE' && pa?.loseInfluenceQueue?.[0] && (
                <div className={styles.mesaLose}>
                  <div className={styles.mesaActionIcon}>💀</div>
                  <p>{players.find(p => p.id === pa.loseInfluenceQueue[0].playerId)?.name}</p>
                  <p>perde uma influência</p>
                </div>
              )}
              {phase === 'INVESTIGATE_DECISION' && pa && (
                <div className={styles.mesaAction}>
                  <div className={styles.mesaActionIcon}>🕵️</div>
                  <div className={styles.mesaActionName}>Investigação</div>
                  <div className={styles.mesaActionPlayers}>
                    <span className={styles.mesaActor}>{actorName}</span>
                    <span className={styles.mesaArrow}>→</span>
                    <span className={styles.mesaTarget}>{targetName}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* My cards */}
          <div className={styles.myCardsArea}>
            <div className={styles.myCardsLabel}>Suas Cartas</div>
            <div className={styles.myCards}>
              {me?.cards.map((c, i) => (
                <Card
                  key={i}
                  character={c.character}
                  dead={c.dead}
                  onClick={() => {
                    if (mustLoseInfluence && !c.dead) setSelectedCardIndex(prev => prev === i ? null : i);
                  }}
                  selected={selectedCardIndex === i}
                />
              ))}
            </div>
            {mustLoseInfluence && <p className={styles.loseHint}>Clique na carta que deseja perder</p>}
          </div>
        </div>

        {/* RIGHT: action menu */}
        <div className={styles.rightPanel}>
          <div className={styles.menuTitle}>Menu de Ações</div>

          {error && <div className={styles.errorMsg}>{error}</div>}

          {/* MY TURN */}
          {canAct && (
            <div className={styles.menuContent}>
              {me?.coins >= 10 && (
                <div className={styles.forceAlert}>⚠️ Com 10+ moedas é obrigatório usar Golpe!</div>
              )}
              {selectedTarget && (
                <div className={styles.targetSelected}>
                  Alvo: <strong>{players.find(p => p.id === selectedTarget)?.name}</strong>
                  <button className={styles.clearTarget} onClick={() => setSelectedTarget(null)}>✕</button>
                </div>
              )}

              <div className={styles.menuSection}>
                <div className={styles.menuSectionTitle}>Ações Básicas</div>
                <button className={`${styles.actionBtn}`} onClick={() => takeAction('renda')} disabled={me?.coins >= 10}>
                  <span className={styles.actionIcon}>💵</span>
                  <div><strong>Renda</strong><small>+1 moeda</small></div>
                </button>
                <button className={`${styles.actionBtn}`} onClick={() => takeAction('ajuda_externa')} disabled={me?.coins >= 10}>
                  <span className={styles.actionIcon}>💰</span>
                  <div><strong>Ajuda Externa</strong><small>+2 moedas</small></div>
                </button>
                <button className={`${styles.actionBtn} ${styles.actionBtnDanger}`} onClick={() => takeAction('golpe')} disabled={(me?.coins || 0) < 7}>
                  <span className={styles.actionIcon}>💥</span>
                  <div><strong>Golpe</strong><small>7 moedas · precisa de alvo</small></div>
                </button>
              </div>

              <div className={styles.menuSection}>
                <div className={styles.menuSectionTitle}>Personagens (pode blefar)</div>
                <button className={`${styles.actionBtn}`} onClick={() => takeAction('taxar')} disabled={me?.coins >= 10}>
                  <span className={styles.actionIcon}>🏛️</span>
                  <div><strong>Taxar</strong><small>+3 moedas (Político)</small></div>
                </button>
                <button className={`${styles.actionBtn}`} onClick={() => takeAction('roubar')} disabled={!selectedTarget}>
                  <span className={styles.actionIcon}>💼</span>
                  <div><strong>Roubar</strong><small>2 moedas do alvo (Empresário)</small></div>
                </button>
                <button className={`${styles.actionBtn} ${styles.actionBtnDanger}`} onClick={() => takeAction('assassinar')} disabled={(me?.coins || 0) < 3 || !selectedTarget}>
                  <span className={styles.actionIcon}>🔪</span>
                  <div><strong>Assassinar</strong><small>3 moedas · alvo perde carta (Assassino)</small></div>
                </button>
                <button className={`${styles.actionBtn}`} onClick={() => takeAction('investigar')} disabled={!selectedTarget}>
                  <span className={styles.actionIcon}>🕵️</span>
                  <div><strong>Investigar</strong><small>ver carta do alvo (Investigador)</small></div>
                </button>
              </div>

              {!selectedTarget && (
                <p className={styles.targetHint}>⬆ Clique em um oponente para selecionar como alvo</p>
              )}
            </div>
          )}

          {/* RESPONSE: challenge or block */}
          {(canChallengeAction || canBlockAction) && (
            <div className={styles.menuContent}>
              <div className={styles.responseHeader}>
                <strong>{actorName}</strong> declara <strong>{ACTION_NAMES[pa?.type]}</strong>
                {targetName && <> em <strong>{targetName}</strong></>}
              </div>

              {canChallengeAction && (
                <div className={styles.menuSection}>
                  <div className={styles.menuSectionTitle}>Desafiar</div>
                  <button className={`${styles.actionBtn} ${styles.actionBtnDanger}`} onClick={handleChallenge}>
                    <span className={styles.actionIcon}>⚔️</span>
                    <div><strong>DUVIDAR</strong><small>Acha que está blefando?</small></div>
                  </button>
                </div>
              )}

              {canBlockAction && blockOptions.length > 0 && (
                <div className={styles.menuSection}>
                  <div className={styles.menuSectionTitle}>Bloquear como...</div>
                  {blockOptions.map(char => (
                    <button
                      key={char}
                      className={`${styles.actionBtn} ${blockChar === char ? styles.actionBtnSelected : ''}`}
                      onClick={() => setBlockChar(prev => prev === char ? null : char)}
                    >
                      <span className={styles.actionIcon}>{CHAR_CONFIG[char]?.icon}</span>
                      <div><strong>{CHAR_CONFIG[char]?.label}</strong><small>clique para selecionar</small></div>
                    </button>
                  ))}
                  {blockChar && (
                    <button className={`${styles.actionBtn} ${styles.actionBtnSuccess}`} onClick={handleBlock}>
                      <span className={styles.actionIcon}>🛡️</span>
                      <div><strong>Confirmar Bloqueio</strong><small>como {CHAR_CONFIG[blockChar]?.label}</small></div>
                    </button>
                  )}
                </div>
              )}

              <div className={styles.menuSection}>
                <button className={`${styles.actionBtn}`} onClick={handlePass}>
                  <span className={styles.actionIcon}>✅</span>
                  <div><strong>Passar</strong><small>deixar a ação acontecer</small></div>
                </button>
              </div>
            </div>
          )}

          {/* BLOCK CHALLENGE */}
          {canChallengeBlock && (
            <div className={styles.menuContent}>
              <div className={styles.responseHeader}>
                <strong>{blockerName}</strong> bloqueou como <strong>{CHAR_CONFIG[pa?.blocker?.character]?.label}</strong>
              </div>
              <div className={styles.menuSection}>
                <button className={`${styles.actionBtn} ${styles.actionBtnDanger}`} onClick={handleChallenge}>
                  <span className={styles.actionIcon}>⚔️</span>
                  <div><strong>DUVIDAR do Bloqueio</strong><small>Acha que está blefando?</small></div>
                </button>
                <button className={`${styles.actionBtn}`} onClick={handlePass}>
                  <span className={styles.actionIcon}>✅</span>
                  <div><strong>Aceitar Bloqueio</strong><small>desistir da ação</small></div>
                </button>
              </div>
            </div>
          )}

          {/* LOSE INFLUENCE */}
          {mustLoseInfluence && (
            <div className={styles.menuContent}>
              <div className={`${styles.responseHeader} ${styles.responseHeaderDanger}`}>
                Você deve perder uma influência
              </div>
              <div className={styles.menuSection}>
                <p style={{ fontSize: '0.82rem', color: 'var(--muted)', marginBottom: 8 }}>
                  Clique na carta que deseja perder (à esquerda) e confirme:
                </p>
                <button
                  className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                  onClick={handleLoseInfluence}
                  disabled={selectedCardIndex === null}
                >
                  <span className={styles.actionIcon}>💀</span>
                  <div>
                    <strong>Perder carta</strong>
                    <small>{selectedCardIndex !== null ? `Carta ${selectedCardIndex + 1} selecionada` : 'Selecione uma carta'}</small>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* INVESTIGATE DECISION */}
          {mustInvestigateDecide && pa?.investigationPeek && (
            <div className={styles.menuContent}>
              <div className={styles.responseHeader}>
                Você viu a carta de <strong>{targetName}</strong>
              </div>
              <div className={styles.investigatePeek}>
                <span>{CHAR_CONFIG[pa.investigationPeek.character]?.icon}</span>
                <strong>{CHAR_CONFIG[pa.investigationPeek.character]?.label}</strong>
              </div>
              <div className={styles.menuSection}>
                <button className={`${styles.actionBtn} ${styles.actionBtnDanger}`} onClick={() => handleInvestigateDecision(true)}>
                  <span className={styles.actionIcon}>🔄</span>
                  <div><strong>Forçar Troca</strong><small>obrigar {targetName} a trocar</small></div>
                </button>
                <button className={`${styles.actionBtn}`} onClick={() => handleInvestigateDecision(false)}>
                  <span className={styles.actionIcon}>✅</span>
                  <div><strong>Manter Carta</strong><small>deixar como está</small></div>
                </button>
              </div>
            </div>
          )}

          {/* Waiting state */}
          {!canAct && !canChallengeAction && !canBlockAction && !canChallengeBlock && !mustLoseInfluence && !mustInvestigateDecide && (
            <div className={styles.menuWaiting}>
              <span className={styles.waitingDot} />
              <span className={styles.waitingDot} />
              <span className={styles.waitingDot} />
              <p>Aguardando...</p>
            </div>
          )}
        </div>
      </div>

      {/* Help modal */}
      {showHelp && (
        <div className={styles.helpOverlay} onClick={() => setShowHelp(false)}>
          <div className={styles.helpModal} onClick={e => e.stopPropagation()}>
            <h2>Personagens</h2>
            {Object.entries(CHAR_CONFIG).map(([key, cfg]) => (
              <div key={key} className={styles.helpRow}>
                <span>{cfg.icon}</span>
                <strong>{cfg.label}</strong>
                <span>{cfg.desc}</span>
              </div>
            ))}
            <button className="btn btn-primary" style={{ marginTop: 16, width: '100%' }} onClick={() => setShowHelp(false)}>Fechar</button>
          </div>
        </div>
      )}
    </div>
  );
}
