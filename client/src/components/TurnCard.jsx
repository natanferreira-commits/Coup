import { motion, AnimatePresence } from 'framer-motion';
import moedaImg from '../assets/moeda.svg';
import styles from './TurnCard.module.css';

export default function TurnCard({ player, isMe }) {
  if (!player) return null;
  const aliveCards = player.cards?.filter(c => !c.dead).length ?? 0;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={player.id}
        className={`${styles.card} ${isMe ? styles.cardMe : ''}`}
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        transition={{ type: 'spring', stiffness: 260, damping: 22 }}
      >
        <div className={styles.badge}>{isMe ? 'SUA VEZ' : 'VEZ DE'}</div>
        <div className={styles.row}>
          <div className={styles.avatar}>{player.name.charAt(0).toUpperCase()}</div>
          <div className={styles.info}>
            <span className={styles.name}>{player.name}</span>
            <div className={styles.stats}>
              <span className={styles.stat}>
                <img src={moedaImg} className={styles.coinIcon} alt="moeda" />
                {player.coins}
              </span>
              <span className={styles.statDivider}>·</span>
              <span className={styles.stat}>
                🃏 {aliveCards} {aliveCards === 1 ? 'carta' : 'cartas'}
              </span>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
