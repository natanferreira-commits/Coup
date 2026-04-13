import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import socket from '../socket';
import Card from '../components/Card';
import { CHAR_CONFIG } from '../components/charConfig';
import GameLog from '../components/GameLog';
import TurnCard from '../components/TurnCard';
import moedaImg from '../assets/moeda.svg';
import styles from './Game.module.css';

const ACTION_NAMES = {
  renda: 'Renda', ajuda_externa: 'Ajuda Externa', golpe: 'Golpe',
  taxar: 'Taxar', roubar: 'Roubar', assassinar: 'Assassinar', investigar: 'Investigar (X9)',
};
const ACTIONS_NEEDING_TARGET = ['golpe', 'roubar', 'assassinar', 'investigar'];
const BLOCK_OPTIONS = {
  ajuda_externa: ['politico'], roubar: ['juiz', 'guarda_costas'],
  assassinar: ['guarda_costas'], investigar: ['juiz'],
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

  const takeAction = action => {
    if (ACTIONS_NEEDING_TARGET.includes(action) && !selectedTarget)
      return setError('Selecione um oponente como alvo primeiro');
    emit('take_action', { action, targetId: selectedTarget }, () => setSelectedTarget(null));
  };
  const handlePass      = () => emit('pass', {});
  const handleChallenge = () => emit('challenge', {});
  const handleBlock     = () => {
    if (!blockChar) return setError('Escolha o personagem para bloquear');
    emit('block', { character: blockChar }, () => setBlockChar(null));
  };
  const handleLoseInfluence = () => {
    if (selectedCardIndex === null) return setError('Selecione uma carta');
    emit('lose_influence', { cardIndex: selectedCardIndex }, () => setSelectedCardIndex(null));
  };
  const handleInvestigateDecision = forceSwap => emit('investigate_decision', { forceSwap });

  const iAmActor    = pa?.actorId === myId;
  const iAmTarget   = pa?.targetId === myId;
  const alreadyResponded = pa?.respondedPlayers?.includes(myId);
  const iAmInLoseQueue   = pa?.loseInfluenceQueue?.[0]?.playerId === myId;

  const canAct             = isMyTurn && phase === 'ACTION_SELECT' && me?.alive;
  const canRespond         = phase === 'RESPONSE_WINDOW' && !iAmActor && !alreadyResponded && me?.alive;
  const canChallengeAction = canRespond && !!pa?.claimedCharacter;
  const canBlockAction     = canRespond && (pa?.type === 'ajuda_externa' ? true : iAmTarget);
  const canChallengeBlock  = phase === 'BLOCK_CHALLENGE_WINDOW' && iAmActor;
  const mustLoseInfluence  = phase === 'LOSE_INFLUENCE' && iAmInLoseQueue;
  const mustInvestigateDecide = phase === 'INVESTIGATE_DECISION' && iAmActor;
  const blockOptions = pa ? (BLOCK_OPTIONS[pa.type] || []) : [];

  const actorName  = pa ? players.find(p => p.id === pa.actorId)?.name : null;
  const targetName = pa?.targetId ? players.find(p => p.id === pa.targetId)?.name : null;
  const blockerName = pa?.blocker ? players.find(p => p.id === pa.blocker.playerId)?.name : null;

  const hasAction = canAct || canChallengeAction || canBlockAction || canChallengeBlock || mustLoseInfluence || mustInvestigateDecide;

  if (winner) {
    const winnerPlayer = players.find(p => p.id === winner);
    return (
      <motion.div className={styles.gameOver}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <motion.div className={styles.gameOverCard}
          initial={{ scale: 0.7, y: 40 }} animate={{ scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 18 }}>
          <h1>FIM DE JOGO</h1>
          <p className={styles.winnerName}>{winnerPlayer?.name} venceu!</p>
          <motion.button className="btn btn-primary" whileTap={{ scale: 0.95 }}
            onClick={() => window.location.reload()}>
            Jogar Novamente
          </motion.button>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <div className={styles.board}>

      {/* ── LEFT: turno + log ── */}
      <div className={styles.leftPanel}>
        <TurnCard
          player={players.find(p => p.id === currentPlayerId)}
          isMe={isMyTurn}
        />
        <p className={styles.panelLabel}>Chat da Rodada</p>
        <GameLog log={log} />
      </div>

      {/* ── CENTER ── */}
      <div className={styles.center}>

        {/* Opponents row — integrated */}
        <div className={styles.opponents}>
          <AnimatePresence>
            {others.map(p => (
              <motion.div
                key={p.id}
                className={`${styles.opponent}
                  ${p.id === currentPlayerId ? styles.opponentActive : ''}
                  ${!p.alive ? styles.opponentDead : ''}
                  ${selectedTarget === p.id ? styles.opponentTargeted : ''}
                `}
                layout
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: p.alive ? 1 : 0.35, y: 0 }}
                whileHover={canAct && p.alive ? { scale: 1.03, y: -2 } : {}}
                whileTap={canAct && p.alive ? { scale: 0.97 } : {}}
                onClick={() => canAct && p.alive && setSelectedTarget(prev => prev === p.id ? null : p.id)}
                style={{ cursor: canAct && p.alive ? 'pointer' : 'default' }}
              >
                <div className={styles.opponentAvatar}>{p.name.charAt(0).toUpperCase()}</div>
                <div className={styles.opponentInfo}>
                  <span className={styles.opponentName}>{p.name}</span>
                  <div className={styles.opponentCoins}>
                    <img src={moedaImg} className={styles.coinIconSm} alt="moeda" />
                    <span>{p.coins}</span>
                  </div>
                </div>
                <div className={styles.opponentCards}>
                  {p.cards.map((c, i) => (
                    <div key={i} className={`${styles.miniCard} ${c.dead ? styles.miniCardDead : ''}`}>
                      {c.dead ? '✕' : c.character ? CHAR_CONFIG[c.character]?.icon : '🃏'}
                    </div>
                  ))}
                </div>
                {p.id === currentPlayerId && (
                  <motion.div className={styles.turnBadge}
                    initial={{ scale: 0 }} animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 400 }}>
                    VEZ
                  </motion.div>
                )}
                {selectedTarget === p.id && (
                  <motion.div className={styles.targetBadge}
                    initial={{ scale: 0 }} animate={{ scale: 1 }}>
                    ALVO
                  </motion.div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Mesa */}
        <div className={styles.mesaWrapper}>
          <motion.div
            className={styles.mesa}
            animate={
              phase === 'RESPONSE_WINDOW' ? { borderColor: '#ffd600', boxShadow: '0 0 40px rgba(255,214,0,0.15)' } :
              phase === 'BLOCK_CHALLENGE_WINDOW' ? { borderColor: '#f44336', boxShadow: '0 0 40px rgba(244,67,54,0.15)' } :
              phase === 'LOSE_INFLUENCE' ? { borderColor: '#f44336', boxShadow: '0 0 40px rgba(244,67,54,0.2)' } :
              { borderColor: 'var(--border)', boxShadow: 'none' }
            }
            transition={{ duration: 0.4 }}
          >
            <AnimatePresence mode="wait">
              {phase === 'ACTION_SELECT' && (
                <motion.div key="action_select" className={styles.mesaContent}
                  initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                  {isMyTurn
                    ? <><span className={styles.mesaTitle} style={{ color: 'var(--yellow)' }}>SUA VEZ</span><p className={styles.mesaSub}>Escolha uma ação abaixo</p></>
                    : <><span className={styles.mesaTitle}>{players.find(p => p.id === currentPlayerId)?.name}</span><p className={styles.mesaSub}>está escolhendo...</p></>
                  }
                </motion.div>
              )}
              {(phase === 'RESPONSE_WINDOW' || phase === 'BLOCK_CHALLENGE_WINDOW') && pa && (
                <motion.div key="response" className={styles.mesaContent}
                  initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                  <span className={styles.mesaIcon}>{pa.claimedCharacter ? CHAR_CONFIG[pa.claimedCharacter]?.icon : '⚡'}</span>
                  <span className={styles.mesaTitle}>{ACTION_NAMES[pa.type]}</span>
                  <div className={styles.mesaPlayers}>
                    <span style={{ color: '#2979ff' }}>{actorName}</span>
                    {targetName && <><span style={{ color: 'var(--muted)' }}>→</span><span style={{ color: 'var(--red)' }}>{targetName}</span></>}
                  </div>
                  {phase === 'BLOCK_CHALLENGE_WINDOW' && pa.blocker && (
                    <motion.div className={styles.mesaBlockBadge}
                      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                      🛡️ {blockerName} bloqueia
                    </motion.div>
                  )}
                </motion.div>
              )}
              {phase === 'LOSE_INFLUENCE' && (
                <motion.div key="lose" className={styles.mesaContent}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <motion.span className={styles.mesaIcon}
                    animate={{ rotate: [0, -10, 10, -10, 10, 0] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}>💀</motion.span>
                  <span className={styles.mesaTitle} style={{ color: 'var(--red)' }}>
                    {players.find(p => p.id === pa?.loseInfluenceQueue?.[0]?.playerId)?.name}
                  </span>
                  <p className={styles.mesaSub}>perde uma influência</p>
                </motion.div>
              )}
              {phase === 'INVESTIGATE_DECISION' && (
                <motion.div key="investigate" className={styles.mesaContent}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <span className={styles.mesaIcon}>🕵️</span>
                  <span className={styles.mesaTitle}>Investigação</span>
                  <div className={styles.mesaPlayers}>
                    <span style={{ color: '#2979ff' }}>{actorName}</span>
                    <span style={{ color: 'var(--muted)' }}>→</span>
                    <span style={{ color: 'var(--red)' }}>{targetName}</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>

        {/* My cards + coins + actions */}
        <div className={styles.myArea}>

          {/* Coin counter */}
          <div className={styles.coinCounter}>
            <img src={moedaImg} className={styles.coinIcon} alt="moeda" />
            <span className={styles.coinNum}>{me?.coins ?? 0}</span>
            {me?.coins >= 10 && (
              <motion.span className={styles.mustCoup}
                animate={{ opacity: [1, 0.5, 1] }} transition={{ repeat: Infinity, duration: 0.8 }}>
                GOLPE OBRIGATÓRIO!
              </motion.span>
            )}
          </div>

          {/* Cards */}
          <div className={styles.myCardsRow}>
            <span className={styles.panelLabel}>Suas Cartas</span>
            <div className={styles.myCards}>
              {me?.cards.map((c, i) => (
                <Card key={i} character={c.character} dead={c.dead}
                  selected={selectedCardIndex === i}
                  onClick={() => mustLoseInfluence && !c.dead && setSelectedCardIndex(prev => prev === i ? null : i)}
                />
              ))}
            </div>
            {mustLoseInfluence && (
              <motion.p className={styles.loseHint}
                animate={{ opacity: [1, 0.4, 1] }} transition={{ repeat: Infinity, duration: 1 }}>
                Clique na carta que deseja perder
              </motion.p>
            )}
          </div>

          {/* Action panel */}
          <AnimatePresence>
            {hasAction && (
              <motion.div className={styles.actionPanel}
                key={phase}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ type: 'spring', stiffness: 260, damping: 22 }}>

                {error && (
                  <motion.div className={styles.errorMsg}
                    initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}>
                    {error}
                  </motion.div>
                )}

                {/* MY TURN */}
                {canAct && (
                  <>
                    {selectedTarget && (
                      <div className={styles.targetPill}>
                        Alvo: <strong>{players.find(p => p.id === selectedTarget)?.name}</strong>
                        <button className={styles.clearTarget} onClick={() => setSelectedTarget(null)}>✕</button>
                      </div>
                    )}
                    <div className={styles.actionGrid}>
                      <ActionBtn icon="💵" label="Renda"         sub="+1 moeda"              disabled={me?.coins >= 10}       onClick={() => takeAction('renda')} />
                      <ActionBtn icon="💰" label="Ajuda Externa" sub="+2 moedas"             disabled={me?.coins >= 10}       onClick={() => takeAction('ajuda_externa')} />
                      <ActionBtn icon="💥" label="Golpe"         sub="7 moedas · precisa alvo" disabled={(me?.coins||0) < 7} onClick={() => takeAction('golpe')} danger />
                      <ActionBtn icon="🏛️" label="Taxar"         sub="+3 moedas (Político)"  disabled={me?.coins >= 10}       onClick={() => takeAction('taxar')} />
                      <ActionBtn icon="💼" label="Roubar"        sub="2 moedas do alvo"                                       onClick={() => takeAction('roubar')} />
                      <ActionBtn icon="🔪" label="Miliciano"     sub="3 moedas · elimina carta" disabled={(me?.coins||0) < 3} onClick={() => takeAction('assassinar')} danger />
                      <ActionBtn icon="🕵️" label="X9"            sub="ver carta do alvo"                                      onClick={() => takeAction('investigar')} />
                    </div>
                    <p className={styles.targetHint}>
                      {selectedTarget
                        ? `✓ Alvo: ${players.find(p => p.id === selectedTarget)?.name} — clique em outro para trocar`
                        : '⬆ Clique em um oponente para selecionar como alvo (obrigatório para Golpe, Roubar, Miliciano e X9)'}
                    </p>
                  </>
                )}

                {/* RESPONSE */}
                {(canChallengeAction || canBlockAction) && (
                  <>
                    <p className={styles.responseTitle}>
                      <strong>{actorName}</strong> declara <strong>{ACTION_NAMES[pa?.type]}</strong>
                      {targetName && <> em <strong>{targetName}</strong></>}
                    </p>
                    <div className={styles.actionGrid}>
                      {canChallengeAction && <ActionBtn icon="⚔️" label="DUVIDAR" sub="chamar de mentiroso" danger onClick={handleChallenge} />}
                      {canBlockAction && blockOptions.map(char => (
                        <ActionBtn key={char} icon={CHAR_CONFIG[char]?.icon}
                          label={`Bloquear como ${CHAR_CONFIG[char]?.label}`}
                          sub="clique para selecionar"
                          selected={blockChar === char}
                          onClick={() => setBlockChar(prev => prev === char ? null : char)} />
                      ))}
                      {blockChar && <ActionBtn icon="🛡️" label="Confirmar Bloqueio" sub={`como ${CHAR_CONFIG[blockChar]?.label}`} success onClick={handleBlock} />}
                      <ActionBtn icon="✅" label="Passar" sub="deixar acontecer" onClick={handlePass} />
                    </div>
                  </>
                )}

                {/* BLOCK CHALLENGE */}
                {canChallengeBlock && (
                  <>
                    <p className={styles.responseTitle}>
                      <strong>{blockerName}</strong> bloqueou como <strong>{CHAR_CONFIG[pa?.blocker?.character]?.label}</strong>
                    </p>
                    <div className={styles.actionGrid}>
                      <ActionBtn icon="⚔️" label="Duvidar do Bloqueio" sub="acha que está blefando?" danger onClick={handleChallenge} />
                      <ActionBtn icon="✅" label="Aceitar Bloqueio" sub="desistir da ação" onClick={handlePass} />
                    </div>
                  </>
                )}

                {/* LOSE INFLUENCE */}
                {mustLoseInfluence && (
                  <>
                    <p className={styles.responseTitle} style={{ color: 'var(--red)' }}>Escolha uma carta para perder</p>
                    <div className={styles.actionGrid}>
                      <ActionBtn icon="💀" label="Perder carta selecionada"
                        sub={selectedCardIndex !== null ? `Carta ${selectedCardIndex + 1}` : 'Selecione uma carta acima'}
                        danger disabled={selectedCardIndex === null} onClick={handleLoseInfluence} />
                    </div>
                  </>
                )}

                {/* INVESTIGATE */}
                {mustInvestigateDecide && pa?.investigationPeek && (
                  <>
                    <p className={styles.responseTitle}>
                      Carta de <strong>{targetName}</strong>: {CHAR_CONFIG[pa.investigationPeek.character]?.icon} <strong>{CHAR_CONFIG[pa.investigationPeek.character]?.label}</strong>
                    </p>
                    <div className={styles.actionGrid}>
                      <ActionBtn icon="🔄" label="Forçar Troca" sub={`${targetName} troca a carta`} danger onClick={() => handleInvestigateDecision(true)} />
                      <ActionBtn icon="✅" label="Manter Carta" sub="deixar como está" onClick={() => handleInvestigateDecision(false)} />
                    </div>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Help button */}
      <motion.button className={styles.helpBtn} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
        onClick={() => setShowHelp(h => !h)}>
        ? Ajuda
      </motion.button>

      {/* Help modal */}
      <AnimatePresence>
        {showHelp && (
          <motion.div className={styles.helpOverlay}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowHelp(false)}>
            <motion.div className={styles.helpModal}
              initial={{ scale: 0.85, y: 30 }} animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.85, opacity: 0 }}
              onClick={e => e.stopPropagation()}>
              <h2>Personagens</h2>
              {Object.entries(CHAR_CONFIG).map(([key, cfg]) => (
                <div key={key} className={styles.helpRow}>
                  <span>{cfg.icon}</span><strong>{cfg.label}</strong><span>{cfg.desc}</span>
                </div>
              ))}
              <motion.button className="btn btn-primary" style={{ marginTop: 16, width: '100%' }}
                whileTap={{ scale: 0.97 }} onClick={() => setShowHelp(false)}>
                Fechar
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Reusable action button ──────────────────────────────────────────────────
function ActionBtn({ icon, label, sub, onClick, disabled, danger, success, selected }) {
  return (
    <motion.button
      className={`${styles.actionBtn}
        ${danger   ? styles.actionBtnDanger   : ''}
        ${success  ? styles.actionBtnSuccess  : ''}
        ${selected ? styles.actionBtnSelected : ''}
      `}
      onClick={onClick}
      disabled={disabled}
      whileHover={!disabled ? { scale: 1.03, y: -1 } : {}}
      whileTap={!disabled ? { scale: 0.96 } : {}}
      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
    >
      <span className={styles.actionIcon}>{icon}</span>
      <div>
        <strong>{label}</strong>
        <small>{sub}</small>
      </div>
    </motion.button>
  );
}
