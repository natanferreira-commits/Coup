import { motion } from 'framer-motion';
import { CHAR_CONFIG } from './charConfig';
import styles from './Card.module.css';

export default function Card({ character, dead = false, hidden = false, onClick, selected }) {
  const cfg = CHAR_CONFIG[character] || { label: character, color: '#333', icon: '?', desc: '', img: null };

  if (dead) {
    return (
      <motion.div
        className={`${styles.card} ${styles.dead}`}
        initial={{ opacity: 1, scale: 1 }}
        animate={{ opacity: 0.45, scale: 0.95, filter: 'grayscale(1)' }}
        transition={{ duration: 0.4 }}
      >
        <span className={styles.deadLabel}>ELIMINADO</span>
        {character && <span className={styles.deadChar}>{cfg.label}</span>}
      </motion.div>
    );
  }

  if (hidden) {
    return (
      <motion.div
        className={`${styles.card} ${styles.hidden} ${selected ? styles.selected : ''}`}
        onClick={onClick}
        whileHover={{ y: -6, scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        animate={selected ? { y: -10, boxShadow: '0 0 0 2px #ffd600' } : {}}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      >
        <div className={styles.hiddenBack}>
          <span className={styles.hiddenIcon}>🃏</span>
          <span className={styles.hiddenLabel}>GOLPE</span>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className={`${styles.card} ${selected ? styles.selected : ''}`}
      style={{ '--char-color': cfg.color }}
      onClick={onClick}
      whileHover={{ y: -8, scale: 1.05, boxShadow: `0 12px 32px ${cfg.color}55` }}
      whileTap={{ scale: 0.97 }}
      animate={selected ? { y: -12, boxShadow: `0 0 0 2px #ffd600, 0 12px 32px ${cfg.color}77` } : {}}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      layout
    >
      <div className={styles.cardInner}>
        {cfg.img
          ? <img src={cfg.img} alt={cfg.label} className={styles.cardImage} />
          : (
            <>
              <div className={styles.cardHeader}>
                <span className={styles.icon}>{cfg.icon}</span>
              </div>
              <div className={styles.cardBody}>
                <span className={styles.name}>{cfg.label}</span>
                <span className={styles.desc}>{cfg.desc}</span>
              </div>
            </>
          )
        }
        <div className={styles.cardFooter}>
          <span className={styles.name}>{cfg.label}</span>
          <span className={styles.desc}>{cfg.desc}</span>
        </div>
      </div>
    </motion.div>
  );
}
