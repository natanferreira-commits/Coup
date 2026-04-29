import { motion, AnimatePresence } from 'framer-motion';
import { CHAR_CONFIG } from '../components/charConfig';
import styles from './SpectatorView.module.css';

const ACTION_NAMES = {
  renda:'Trampo Suado', ajuda_externa:'Imposto é Roubo', golpe:'Golpe de Estado',
  taxar:'Faz o L', roubar:'Pegar o Arrego', assassinar:'Mandar pro Vasco',
  veredito:'Veredito', meter_x9:'Meter o X9', disfarce:'Disfarce', trocar_carta:'Infiltrar',
};

const PHASE_LABEL = {
  ACTION_SELECT:          { label: 'Escolhendo ação',       color: '#82b1ff' },
  RESPONSE_WINDOW:        { label: 'Janela de resposta',    color: '#ffd600' },
  BLOCK_CHALLENGE_WINDOW: { label: 'Desafio ao bloqueio',   color: '#ff7043' },
  LOSE_INFLUENCE:         { label: 'Perdendo carta',        color: '#ef5350' },
  CHALLENGE_WON:          { label: 'Duvidada falhou!',      color: '#69f0ae' },
  X9_PEEK_SELECT:         { label: 'X9 espionando',         color: '#ce93d8' },
  X9_PEEK_VIEW:           { label: 'Resultado do X9',       color: '#ce93d8' },
  CARD_SWAP_SELECT:       { label: 'Trocando carta',        color: '#ffb74d' },
  DISFARCE_SELECT:        { label: 'Escolhendo disfarce',   color: '#80cbc4' },
  COIN_FLIP:              { label: 'Cara ou Coroa!',        color: '#ffd600' },
  GAME_OVER:              { label: 'Fim de jogo',           color: '#ef5350' },
};

// ── Compact character card for spectator view ─────────────────────────────────
function SpectCard({ character, dead }) {
  const cfg = CHAR_CONFIG[character] || {};
  return (
    <div
      className={`${styles.specCard}${dead ? ` ${styles.specCardDead}` : ''}`}
      style={{ '--char-color': cfg.color || '#666' }}
      title={cfg.label || character}
    >
      {cfg.img
        ? <img src={cfg.img} alt={cfg.label} className={styles.specCardImg} />
        : <span className={styles.specCardEmoji}>{cfg.icon || '🃏'}</span>
      }
      <span className={styles.specCardLabel}>{cfg.label || character}</span>
      {dead && <div className={styles.specCardDeadBadge}>💀</div>}
    </div>
  );
}

// ── Player panel ──────────────────────────────────────────────────────────────
function PlayerPanel({ p, isActive, pa }) {
  const isActor  = pa?.actorId  === p.id;
  const isTarget = pa?.targetId === p.id;
  const responded = pa?.respondedPlayers?.includes(p.id);

  return (
    <motion.div
      className={`
        ${styles.playerPanel}
        ${!p.alive ? styles.eliminated : ''}
        ${isActive  ? styles.activePlayer : ''}
        ${isActor   ? styles.actorPlayer  : ''}
        ${isTarget  ? styles.targetPlayer : ''}
      `}
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* Name row */}
      <div className={styles.playerNameRow}>
        <span className={styles.playerName}>{p.name}</span>
        {isActive  && <span className={styles.turnBadge}>🎯 VEZ</span>}
        {isActor   && pa  && <span className={styles.actorBadge}>⚡ AGIU</span>}
        {isTarget  && pa  && <span className={styles.targetBadge}>🎯 ALVO</span>}
        {responded && !isActor && <span className={styles.respondedBadge}>✓</span>}
        {!p.alive  && <span className={styles.elimBadge}>FORA</span>}
      </div>

      {/* Coins */}
      <div className={styles.coinRow}>
        <img
          src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='11' fill='%23ffd600'/%3E%3Ccircle cx='12' cy='12' r='9' fill='%23ffb300'/%3E%3Ctext x='12' y='16.5' font-size='9' text-anchor='middle' fill='%23795500' font-weight='bold'%3E$%3C/text%3E%3C/svg%3E"
          alt="moeda" width={14} height={14}
        />
        <span className={styles.coinCount}>{p.coins}</span>
      </div>

      {/* Cards — omniscient view */}
      <div className={styles.cardRow}>
        {p.cards.map((c, i) => (
          <SpectCard key={i} character={c.character} dead={c.dead} />
        ))}
      </div>
    </motion.div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function SpectatorView({ spectatorData, onLeave }) {
  if (!spectatorData) return null;

  const { game, queuePosition, code } = spectatorData;
  const pa      = game?.pendingAction;
  const phase   = game?.phase;
  const phaseMeta = PHASE_LABEL[phase] || { label: phase, color: '#aaa' };
  const actorName   = pa ? game?.players?.find(p => p.id === pa.actorId)?.name  : null;
  const targetName  = pa?.targetId ? game?.players?.find(p => p.id === pa.targetId)?.name : null;
  const blockerName = pa?.blocker   ? game?.players?.find(p => p.id === pa.blocker.playerId)?.name : null;

  return (
    <div className={styles.container}>
      {/* ── Top banner ── */}
      <div className={styles.banner}>
        <div className={styles.bannerLeft}>
          <span className={styles.bannerIcon}>👁️</span>
          <div>
            <p className={styles.bannerTitle}>MODO ESPECTADOR</p>
            <p className={styles.bannerSub}>
              {game?.winner
                ? '🏆 Partida encerrada'
                : `Fila: #${queuePosition} · você entra na próxima rodada`}
            </p>
          </div>
        </div>
        <div className={styles.bannerRight}>
          <span className={styles.roundBadge}>Round {game?.roundNumber || 1}</span>
          <button className={styles.leaveBtn} onClick={onLeave}>Sair</button>
        </div>
      </div>

      <div className={styles.content}>
        {/* ── Phase + action bar ── */}
        <div className={styles.phaseBar} style={{ '--phase-color': phaseMeta.color }}>
          <span className={styles.phaseLabel} style={{ color: phaseMeta.color }}>
            {phaseMeta.label}
          </span>

          {pa && (
            <span className={styles.actionDesc}>
              {actorName && <strong>{actorName}</strong>}
              {pa.type && <> → <em>{ACTION_NAMES[pa.type] || pa.type}</em></>}
              {targetName && <> em <strong>{targetName}</strong></>}
              {pa.claimedCharacter && (
                <> como {CHAR_CONFIG[pa.claimedCharacter]?.icon} {CHAR_CONFIG[pa.claimedCharacter]?.label}</>
              )}
              {pa.blocker && blockerName && (
                <span style={{ color: '#ff7043' }}> · 🛡️ {blockerName} bloqueou</span>
              )}
            </span>
          )}

          {phase === 'ACTION_SELECT' && game?.currentPlayerId && (
            <span className={styles.actionDesc}>
              Vez de <strong>{game.players.find(p => p.id === game.currentPlayerId)?.name}</strong>
            </span>
          )}
        </div>

        {/* ── Players grid — omniscient ── */}
        <div className={styles.playersGrid}>
          {game?.players?.map(p => (
            <PlayerPanel
              key={p.id}
              p={p}
              isActive={p.id === game.currentPlayerId}
              pa={pa}
            />
          ))}
        </div>

        {/* ── Game log ── */}
        <div className={styles.logBox}>
          <p className={styles.logTitle}>📋 Histórico</p>
          <div className={styles.logList}>
            {[...(game?.log ?? [])].reverse().map((line, i) => (
              <p key={i} className={`${styles.logLine}${i === 0 ? ` ${styles.logLineLatest}` : ''}`}>
                {line}
              </p>
            ))}
          </div>
        </div>

        {/* ── Game over ── */}
        <AnimatePresence>
          {game?.winner && (
            <motion.div
              className={styles.winnerBanner}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              👑 {game.players.find(p => p.id === game.winner)?.name} venceu!
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
