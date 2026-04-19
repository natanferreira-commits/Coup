import { motion } from 'framer-motion';
import styles from './SpectatorView.module.css';

const PHASE_LABEL = {
  ACTION_SELECT:          'Escolhendo ação',
  RESPONSE_WINDOW:        'Aguardando resposta',
  BLOCK_CHALLENGE_WINDOW: 'Desafio ao bloqueio',
  LOSE_INFLUENCE:         'Perdendo influência',
  X9_PEEK_SELECT:         'X9 espionando',
  X9_PEEK_VIEW:           'Resultado do X9',
  CARD_SWAP_SELECT:       'Trocando carta',
  GAME_OVER:              'Fim de jogo',
};

export default function SpectatorView({ spectatorData, onLeave }) {
  if (!spectatorData) return null;

  const { game, queuePosition, code } = spectatorData;
  const alivePlayers = game?.players?.filter(p => p.alive) ?? [];

  return (
    <div className={styles.container}>
      {/* Header banner */}
      <motion.div
        className={styles.banner}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <span className={styles.bannerIcon}>👁️</span>
        <div>
          <p className={styles.bannerTitle}>Você está assistindo</p>
          <p className={styles.bannerSub}>
            {game?.winner
              ? '🏆 Partida encerrada — você entra na próxima rodada'
              : `Posição na fila: #${queuePosition} · você entra na próxima rodada`}
          </p>
        </div>
        <button className={styles.leaveBtn} onClick={onLeave}>Sair</button>
      </motion.div>

      <div className={styles.content}>
        {/* Current phase */}
        <div className={styles.phaseBox}>
          <span className={styles.phaseLabel}>
            {PHASE_LABEL[game?.phase] ?? game?.phase}
          </span>
          {game?.currentPlayerId && (
            <span className={styles.turnLabel}>
              Vez de <strong>{game.players.find(p => p.id === game.currentPlayerId)?.name ?? '…'}</strong>
            </span>
          )}
        </div>

        {/* Players */}
        <div className={styles.players}>
          {game?.players?.map(p => (
            <motion.div
              key={p.id}
              className={`${styles.playerCard} ${!p.alive ? styles.eliminated : ''} ${p.id === game.currentPlayerId ? styles.active : ''}`}
              layout
            >
              <span className={styles.playerName}>{p.name}</span>
              <span className={styles.coins}>💰 {p.coins}</span>
              <div className={styles.cardPips}>
                {p.cards.map((c, i) => (
                  <span key={i} className={`${styles.pip} ${c.dead ? styles.deadPip : ''}`}>
                    {c.dead ? '💀' : '🃏'}
                  </span>
                ))}
              </div>
              {!p.alive && <span className={styles.elim}>ELIMINADO</span>}
            </motion.div>
          ))}
        </div>

        {/* Log */}
        <div className={styles.logBox}>
          <p className={styles.logTitle}>📋 Log da partida</p>
          <div className={styles.logList}>
            {[...(game?.log ?? [])].reverse().map((line, i) => (
              <p key={i} className={styles.logLine}>{line}</p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
