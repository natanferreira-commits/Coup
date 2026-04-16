import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import socket from '../socket';
import Card from '../components/Card';
import { CHAR_CONFIG } from '../components/charConfig';
import GameLog from '../components/GameLog';
import TurnCard from '../components/TurnCard';
import CardSelectorModal from '../components/CardSelectorModal';
import moedaImg from '../assets/moeda.svg';
import mesaImg  from '../assets/mesa.svg';
import styles from './Game.module.css';

const ACTION_NAMES = {
  renda:        'Trampo Suado',
  ajuda_externa:'Imposto é Roubo',
  golpe:        'Golpe de Estado',
  taxar:        'Faz o L',
  roubar:       'Pegar o Arrego',
  assassinar:   'Mandar pro Vasco',
  meter_x9:     'Meter o X9',
  disfarce:     'Disfarce',
  trocar_carta: 'Troca de Cartas',
};

const TARGET_ACTIONS = ['golpe', 'roubar', 'assassinar', 'meter_x9', 'trocar_carta'];

const BLOCK_OPTIONS = {
  ajuda_externa: ['politico'],
  roubar:        ['juiz', 'guarda_costas'],
  assassinar:    ['guarda_costas'],
  meter_x9:      ['juiz'],
  disfarce:      ['juiz'],
  trocar_carta:  ['juiz'],
};

// Character → actions it enables
const CHAR_ACTIONS = {
  politico:      [{ action: 'taxar',        icon: '🏛️', label: 'Faz o L',          sub: '+3 moedas'               }],
  empresario:    [{ action: 'roubar',       icon: '💼', label: 'Pegar o Arrego',   sub: 'Rouba 2 moedas do alvo'  }],
  investigador:  [
    { action: 'meter_x9',     icon: '🕵️', label: 'Meter o X9',     sub: 'Espia carta do alvo'     },
    { action: 'disfarce',     icon: '🎭', label: 'Disfarce',        sub: 'Troca sua própria carta'  },
    { action: 'trocar_carta', icon: '🔄', label: 'Troca de Cartas', sub: 'Força o alvo a trocar'    },
  ],
  juiz:          [],
  assassino:     [{ action: 'assassinar',   icon: '🔫', label: 'Mandar pro Vasco', sub: 'Elimina carta · 3 moedas' }],
  guarda_costas: [],
};

export default function Game({ data, myId }) {
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [selectedChar,   setSelectedChar]   = useState(null);
  const [blockChar,      setBlockChar]       = useState(null);
  const [error,          setError]           = useState('');
  const [showHelp,       setShowHelp]        = useState(false);

  const game = data?.game;
  const { players, currentPlayerId, phase, pendingAction: pa, log, winner } = game || {};

  // Reset selections on phase change
  useEffect(() => {
    setSelectedChar(null);
    setBlockChar(null);
    setError('');
  }, [phase]);

  if (!game) return <div className={styles.loading}>Carregando...</div>;

  const me       = players.find(p => p.id === myId);
  const others   = players.filter(p => p.id !== myId);
  const isMyTurn = currentPlayerId === myId;
  const myCoins  = me?.coins ?? 0;

  function emit(event, payload, cb) {
    setError('');
    socket.emit(event, payload ?? {}, res => {
      if (res && !res.success) setError(res.error || 'Erro desconhecido');
      cb?.();
    });
  }

  const takeAction = action => {
    if (TARGET_ACTIONS.includes(action) && !selectedTarget)
      return setError('Selecione um oponente como alvo primeiro ⬆');
    emit('take_action', { action, targetId: selectedTarget }, () => {
      setSelectedTarget(null);
      setSelectedChar(null);
    });
  };

  const iAmActor         = pa?.actorId === myId;
  const iAmTarget        = pa?.targetId === myId;
  const alreadyResponded = pa?.respondedPlayers?.includes(myId);
  const iAmInLoseQueue   = pa?.loseInfluenceQueue?.[0]?.playerId === myId;
  const iAmSwapPlayer    = pa?.swapPlayerId === myId;

  const canAct            = isMyTurn && phase === 'ACTION_SELECT' && me?.alive;
  const canRespond        = phase === 'RESPONSE_WINDOW' && !iAmActor && !alreadyResponded && me?.alive;
  // For targeted actions: only the target can challenge or block
  const isTargetedAction  = TARGET_ACTIONS.includes(pa?.type);
  const canChallengeAct   = canRespond && !!pa?.claimedCharacter && (!isTargetedAction || iAmTarget);
  const canBlockAct       = canRespond && (pa?.type === 'ajuda_externa' ? true : iAmTarget);
  const canChallengeBlock = phase === 'BLOCK_CHALLENGE_WINDOW' && iAmActor;

  const mustLoseInfluence   = phase === 'LOSE_INFLUENCE'   && iAmInLoseQueue;
  const mustShowCard        = phase === 'X9_PEEK_SELECT'   && iAmTarget;
  const mustAcknowledgePeek = phase === 'X9_PEEK_VIEW'    && iAmActor;
  const mustSwapCard        = phase === 'CARD_SWAP_SELECT' && iAmSwapPlayer;

  const blockOptions = pa ? (BLOCK_OPTIONS[pa.type] || []) : [];
  const actorName    = pa ? players.find(p => p.id === pa.actorId)?.name  : null;
  const targetName   = pa?.targetId ? players.find(p => p.id === pa.targetId)?.name : null;
  const blockerName  = pa?.blocker  ? players.find(p => p.id === pa.blocker.playerId)?.name : null;

  // ── Game over ────────────────────────────────────────────────────────────────
  if (winner) {
    const w = players.find(p => p.id === winner);
    return (
      <motion.div className={styles.gameOver} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <motion.div className={styles.gameOverCard}
          initial={{ scale: 0.7, y: 40 }} animate={{ scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 18 }}>
          <h1>FIM DE JOGO</h1>
          <p className={styles.winnerName}>{w?.name} venceu o Golpe! 🇧🇷</p>
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

      {/* ── Modals ── */}
      {mustLoseInfluence && (
        <CardSelectorModal context="lose"
          title="Perdeu, mané 💀"
          description="Você deve perder uma carta. Escolha qual revelar para a mesa."
          cards={me?.cards || []} confirmLabel="Perder"
          onConfirm={i => emit('lose_influence', { cardIndex: i })} />
      )}
      {mustShowCard && (
        <CardSelectorModal context="show"
          title="O X9 tá de olho 👀"
          description={`${actorName} meteu o X9 em você. Escolha uma carta para mostrar APENAS a ele.`}
          cards={me?.cards || []} confirmLabel="Mostrar"
          onConfirm={i => emit('select_card_show', { cardIndex: i })} />
      )}
      {mustSwapCard && (
        <CardSelectorModal context="swap"
          title={pa?.swapContext === 'disfarce' ? 'Hora do Disfarce 🎭' : 'Troca Forçada 🔄'}
          description={
            pa?.swapContext === 'disfarce'
              ? 'Escolha uma carta para trocar pelo baralho.'
              : `${actorName} forçou uma troca. Escolha qual carta trocar.`
          }
          cards={me?.cards || []} confirmLabel="Trocar"
          onConfirm={i => emit('select_card_swap', { cardIndex: i })} />
      )}

      {/* ── LEFT: turn + log ── */}
      <div className={styles.leftPanel}>
        <TurnCard player={players.find(p => p.id === currentPlayerId)} isMe={isMyTurn} />
        <p className={styles.panelLabel}>Chat da Rodada</p>
        <GameLog log={log} />
      </div>

      {/* ── CENTER ── */}
      <div className={styles.center}>

        {/* Opponents */}
        <div className={styles.opponents}>
          {others.map(p => (
            <motion.div key={p.id}
              className={`${styles.opponent}
                ${p.id === currentPlayerId ? styles.opponentActive : ''}
                ${!p.alive ? styles.opponentDead : ''}
                ${selectedTarget === p.id ? styles.opponentTargeted : ''}
              `}
              whileHover={canAct && p.alive ? { scale: 1.03, y: -2 } : {}}
              whileTap={canAct && p.alive ? { scale: 0.97 } : {}}
              onClick={() => canAct && p.alive && setSelectedTarget(prev => prev === p.id ? null : p.id)}
              style={{ cursor: canAct && p.alive ? 'pointer' : 'default' }}>
              <div className={styles.opponentAvatar}>{p.name.charAt(0).toUpperCase()}</div>
              <div className={styles.opponentInfo}>
                <span className={styles.opponentName}>{p.name}</span>
                <div className={styles.opponentCoins}>
                  <img src={moedaImg} className={styles.coinIconSm} alt="" />
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
              {p.id === currentPlayerId && <div className={styles.turnBadge}>VEZ</div>}
              {selectedTarget === p.id && <div className={styles.targetBadge}>ALVO</div>}
            </motion.div>
          ))}
        </div>

        {/* Mesa — status label ABOVE the SVG */}
        <div className={styles.mesaWrapper}>

          {/* Status text — floats above the diamond */}
          <AnimatePresence mode="wait">

            {phase === 'ACTION_SELECT' && (
              <motion.div key="sel" className={styles.mesaStatus}
                initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                {isMyTurn
                  ? <span className={styles.mesaStatusMain} style={{ color: 'var(--yellow)' }}>✦ SUA VEZ — escolha uma ação</span>
                  : <span className={styles.mesaStatusMain}>{players.find(p => p.id === currentPlayerId)?.name} está pensando...</span>
                }
              </motion.div>
            )}

            {(phase === 'RESPONSE_WINDOW' || phase === 'BLOCK_CHALLENGE_WINDOW') && pa && (
              <motion.div key="resp" className={styles.mesaStatus}
                initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <span className={styles.mesaStatusIcon}>{pa.claimedCharacter ? CHAR_CONFIG[pa.claimedCharacter]?.icon : '⚡'}</span>
                <span className={styles.mesaStatusMain}>{ACTION_NAMES[pa.type]}</span>
                <span className={styles.mesaStatusSub}>
                  <span style={{ color: '#82b1ff' }}>{actorName}</span>
                  {targetName && <>{' → '}<span style={{ color: '#ef9a9a' }}>{targetName}</span></>}
                </span>
                {phase === 'BLOCK_CHALLENGE_WINDOW' && pa.blocker && (
                  <span className={styles.mesaStatusBlock}>🛡️ {blockerName} bloqueou</span>
                )}
              </motion.div>
            )}

            {phase === 'LOSE_INFLUENCE' && (
              <motion.div key="lose" className={styles.mesaStatus}
                initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <span className={styles.mesaStatusIcon}>💀</span>
                <span className={styles.mesaStatusMain} style={{ color: 'var(--red)' }}>
                  {players.find(p => p.id === pa?.loseInfluenceQueue?.[0]?.playerId)?.name} perde uma carta
                </span>
              </motion.div>
            )}

            {(phase === 'X9_PEEK_SELECT' || phase === 'X9_PEEK_VIEW') && (
              <motion.div key="x9" className={styles.mesaStatus}
                initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <span className={styles.mesaStatusIcon}>🕵️</span>
                <span className={styles.mesaStatusMain} style={{ color: '#ce93d8' }}>X9 em ação</span>
                <span className={styles.mesaStatusSub}>
                  <span style={{ color: '#82b1ff' }}>{actorName}</span>
                  {' → '}
                  <span style={{ color: '#ef9a9a' }}>{targetName}</span>
                </span>
              </motion.div>
            )}

            {phase === 'CARD_SWAP_SELECT' && (
              <motion.div key="swap" className={styles.mesaStatus}
                initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <span className={styles.mesaStatusIcon}>🔄</span>
                <span className={styles.mesaStatusMain} style={{ color: '#82b1ff' }}>
                  {pa?.swapContext === 'disfarce' ? 'Disfarce' : 'Troca de Cartas'}
                </span>
                <span className={styles.mesaStatusSub}>
                  {players.find(p => p.id === pa?.swapPlayerId)?.name} escolhe uma carta
                </span>
              </motion.div>
            )}

          </AnimatePresence>

          {/* The diamond SVG — bigger, no text inside */}
          <motion.img
            src={mesaImg}
            className={styles.mesaImg}
            alt="mesa"
            animate={
              phase === 'RESPONSE_WINDOW'        ? { filter: 'brightness(1.15) drop-shadow(0 0 18px #ffd60088)' } :
              phase === 'BLOCK_CHALLENGE_WINDOW'  ? { filter: 'brightness(1.1)  drop-shadow(0 0 18px #f4433688)' } :
              phase === 'LOSE_INFLUENCE'          ? { filter: 'brightness(1.05) drop-shadow(0 0 16px #f4433666)' } :
              phase === 'X9_PEEK_SELECT'          ? { filter: 'brightness(1.1)  drop-shadow(0 0 18px #9c27b088)' } :
              phase === 'X9_PEEK_VIEW'            ? { filter: 'brightness(1.1)  drop-shadow(0 0 18px #9c27b088)' } :
              { filter: 'brightness(1) drop-shadow(0 0 0px transparent)' }
            }
            transition={{ duration: 0.4 }}
          />
        </div>

        {/* My cards — bigger, with coins on the left */}
        <div className={styles.myArea}>
          {/* Coin display */}
          <div className={styles.coinSide}>
            <img src={moedaImg} className={styles.coinIcon} alt="moeda" />
            <span className={styles.coinNum}>{myCoins}</span>
            {myCoins >= 10 && (
              <motion.span className={styles.mustCoup}
                animate={{ opacity: [1, 0.4, 1] }} transition={{ repeat: Infinity, duration: 0.8 }}>
                GOLPE!
              </motion.span>
            )}
          </div>
          {/* Cards */}
          <div className={styles.myCards}>
            {me?.cards.map((c, i) => (
              <Card key={i} character={c.character} dead={c.dead} size="xl" />
            ))}
          </div>
        </div>
      </div>

      {/* ── RIGHT: actions on top, character cards on bottom ── */}
      <div className={styles.rightPanel}>

        {/* ── ACTIONS (top half) ── */}
        <div className={styles.actionsTop}>

          {/* X9 peek */}
          {mustAcknowledgePeek && pa?.x9Result && (
            <motion.div className={styles.x9Result}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <p className={styles.x9ResultTitle}>🕵️ Carta de <strong>{targetName}</strong>:</p>
              <div className={styles.x9ResultCard}>
                <span>{CHAR_CONFIG[pa.x9Result.character]?.icon}</span>
                <strong>{CHAR_CONFIG[pa.x9Result.character]?.label}</strong>
              </div>
              <motion.button className={styles.x9AckBtn} whileTap={{ scale: 0.96 }}
                onClick={() => emit('acknowledge_peek', {})}>
                Ok, guardei no coração 🤫
              </motion.button>
            </motion.div>
          )}

          {/* My turn — basic + character actions */}
          {canAct && (
            <>
              {/* Target pill */}
              {selectedTarget && (
                <div className={styles.targetPill}>
                  🎯 <strong>{players.find(p => p.id === selectedTarget)?.name}</strong>
                  <button className={styles.clearTarget} onClick={() => setSelectedTarget(null)}>✕</button>
                </div>
              )}

              {/* Selected character's actions */}
              <AnimatePresence>
                {selectedChar && CHAR_ACTIONS[selectedChar]?.length > 0 && (
                  <motion.div className={styles.charActionBox}
                    key={selectedChar}
                    initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}>
                    {CHAR_ACTIONS[selectedChar].map(({ action, icon, label, sub }) => (
                      <Btn key={action} icon={icon} label={label} sub={sub}
                        disabled={action === 'assassinar' && myCoins < 3}
                        onClick={() => takeAction(action)} />
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className={styles.basicActionsBox}>
                <span className={styles.sectionLabel}>⚡ Ações Básicas</span>
                <Btn icon="💵" label="Trampo Suado"    sub="+1 moeda"
                  disabled={myCoins >= 10} onClick={() => takeAction('renda')} />
                <Btn icon="💸" label="Imposto é Roubo" sub="+2 moedas"
                  disabled={myCoins >= 10} onClick={() => takeAction('ajuda_externa')} />
                {myCoins >= 7 && (
                  <Btn icon="💥" label="Golpe de Estado"
                    sub={selectedTarget ? '7💰 · confirmar alvo' : '7💰 · selecione alvo'}
                    danger onClick={() => takeAction('golpe')} />
                )}
              </div>

              {!selectedTarget && (
                <p className={styles.hint}>⬆ Clique num oponente para selecionar alvo</p>
              )}
            </>
          )}

          {/* Waiting (not my turn, no response needed) */}
          {!canAct && !canChallengeAct && !canBlockAct && !canChallengeBlock && !mustAcknowledgePeek && me?.alive && (
            <p className={styles.hint}>
              {phase === 'RESPONSE_WINDOW' && !iAmActor && alreadyResponded
                ? '✅ Aguardando outros jogadores...'
                : phase === 'RESPONSE_WINDOW' && !iAmActor && !iAmTarget && isTargetedAction
                ? '👀 Só o alvo pode responder esta ação'
                : '⌛ Aguardando sua vez...'}
            </p>
          )}

          {/* Response window */}
          {(canChallengeAct || canBlockAct) && (
            <motion.div className={styles.responseBox}
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
              <p className={styles.responseTitle}>
                <strong>{actorName}</strong> declara <strong>{ACTION_NAMES[pa?.type]}</strong>
                {targetName && <> em <strong>{targetName}</strong></>}
              </p>
              {canChallengeAct && (
                <Btn icon="⚔️" label="DUVIDAR" sub="chamar o VAR!" danger
                  onClick={() => emit('challenge', {})} />
              )}
              {canBlockAct && blockOptions.map(char => (
                <Btn key={char}
                  icon={CHAR_CONFIG[char]?.icon}
                  label={`Bloquear como ${CHAR_CONFIG[char]?.label}`}
                  sub="clique para selecionar"
                  selected={blockChar === char}
                  onClick={() => setBlockChar(p => p === char ? null : char)} />
              ))}
              {blockChar && (
                <Btn icon="🛡️" label="Confirmar Bloqueio"
                  sub={`como ${CHAR_CONFIG[blockChar]?.label}`} success
                  onClick={() => emit('block', { character: blockChar }, () => setBlockChar(null))} />
              )}
              <Btn icon="✅" label="Ignorar" sub="deixar acontecer"
                onClick={() => emit('pass', {})} />
            </motion.div>
          )}

          {/* Block challenge */}
          {canChallengeBlock && (
            <motion.div className={styles.responseBox}
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
              <p className={styles.responseTitle}>
                <strong>{blockerName}</strong> bloqueou como{' '}
                <strong>{CHAR_CONFIG[pa?.blocker?.character]?.label}</strong>
              </p>
              <Btn icon="⚔️" label="Duvidar do Bloqueio" sub="chama o VAR!" danger
                onClick={() => emit('challenge', {})} />
              <Btn icon="✅" label="Aceitar Bloqueio" sub="desistir da jogada"
                onClick={() => emit('pass', {})} />
            </motion.div>
          )}

          <AnimatePresence>
            {error && (
              <motion.div className={styles.errorMsg}
                initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
                {error}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── CHARACTER CARDS (bottom half — small) ── */}
        <div className={styles.charSection}>
          <p className={styles.panelLabel}>
            {canAct ? 'Fingir um personagem' : 'Personagens'}
          </p>
          <div className={styles.charGrid}>
            {Object.entries(CHAR_CONFIG).map(([charKey, cfg]) => {
              const isMine     = me?.cards.some(c => !c.dead && c.character === charKey);
              const isSelected = selectedChar === charKey;
              const hasActions = canAct && (CHAR_ACTIONS[charKey]?.length > 0);
              return (
                <motion.div key={charKey}
                  className={`${styles.charCard}
                    ${isMine     ? styles.charCardMine     : ''}
                    ${isSelected ? styles.charCardSelected : ''}
                  `}
                  style={{ '--char-color': cfg.color }}
                  onClick={() => hasActions && setSelectedChar(p => p === charKey ? null : charKey)}
                  whileHover={hasActions ? { scale: 1.06, y: -2 } : {}}
                  whileTap={hasActions ? { scale: 0.96 } : {}}
                  transition={{ type: 'spring', stiffness: 360, damping: 22 }}>
                  {cfg.img
                    ? <img src={cfg.img} alt={cfg.label} className={styles.charCardImg} />
                    : <div className={styles.charCardFallback}><span>{cfg.icon}</span></div>
                  }
                  {isMine && <div className={styles.mineBadge}>✓</div>}
                  {isSelected && <div className={styles.selectedBadge}>✓ USANDO</div>}
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Help */}
      <motion.button className={styles.helpBtn}
        whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
        onClick={() => setShowHelp(h => !h)}>
        ? Regras
      </motion.button>

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

function Btn({ icon, label, sub, onClick, disabled, danger, success, selected }) {
  return (
    <motion.button
      className={`${styles.actionBtn}
        ${danger   ? styles.actionBtnDanger   : ''}
        ${success  ? styles.actionBtnSuccess  : ''}
        ${selected ? styles.actionBtnSelected : ''}
      `}
      disabled={disabled}
      onClick={onClick}
      whileHover={!disabled ? { scale: 1.03, y: -1 } : {}}
      whileTap={!disabled ? { scale: 0.96 } : {}}
      transition={{ type: 'spring', stiffness: 400, damping: 20 }}>
      <span className={styles.actionIcon}>{icon}</span>
      <div><strong>{label}</strong><small>{sub}</small></div>
    </motion.button>
  );
}
