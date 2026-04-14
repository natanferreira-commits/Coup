import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CHAR_CONFIG } from './charConfig';
import styles from './CardSelectorModal.module.css';

export default function CardSelectorModal({ title, description, cards, confirmLabel, onConfirm, context }) {
  const [selected, setSelected] = useState(null);

  const aliveCards = cards
    .map((c, i) => ({ ...c, index: i }))
    .filter(c => !c.dead);

  return (
    <motion.div className={styles.overlay}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <motion.div className={`${styles.modal} ${styles[context] || ''}`}
        initial={{ scale: 0.88, y: 30 }} animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 280, damping: 22 }}>

        <div className={styles.header}>
          <div className={styles.contextIcon}>
            {context === 'lose'  && '💀'}
            {context === 'show'  && '👀'}
            {context === 'swap'  && '🔄'}
          </div>
          <div>
            <h3 className={styles.title}>{title}</h3>
            <p className={styles.desc}>{description}</p>
          </div>
        </div>

        <div className={styles.cards}>
          {aliveCards.map(card => {
            const cfg = CHAR_CONFIG[card.character] || {};
            const isSelected = selected === card.index;
            return (
              <motion.div
                key={card.index}
                className={`${styles.card} ${isSelected ? styles.cardSelected : ''}`}
                style={{ '--char-color': cfg.color || '#333' }}
                onClick={() => setSelected(card.index)}
                whileHover={{ y: -4 }}
                whileTap={{ scale: 0.96 }}
                transition={{ type: 'spring', stiffness: 350, damping: 20 }}
              >
                {cfg.img
                  ? <img src={cfg.img} alt={cfg.label} className={styles.cardImg} />
                  : (
                    <>
                      <span className={styles.cardIcon}>{cfg.icon}</span>
                      <div className={styles.cardFooter}>
                        <span className={styles.cardName}>{cfg.label || card.character}</span>
                      </div>
                    </>
                  )
                }
              </motion.div>
            );
          })}
        </div>

        <motion.button
          className={`${styles.confirmBtn} ${context === 'lose' ? styles.confirmDanger : ''}`}
          disabled={selected === null}
          onClick={() => selected !== null && onConfirm(selected)}
          whileTap={{ scale: 0.96 }}
        >
          {selected !== null
            ? `${confirmLabel}: ${CHAR_CONFIG[aliveCards.find(c => c.index === selected)?.character]?.label}`
            : 'Selecione uma carta acima'}
        </motion.button>
      </motion.div>
    </motion.div>
  );
}
