import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactDOM from 'react-dom';
import { CHAR_CONFIG } from './charConfig';
import styles from './DisfarceModal.module.css';

/**
 * DisfarceModal — mostra 2 opções do baralho para o X9 escolher trocar
 *
 * Props:
 *   pa         : pendingAction (with pa.disfarceOptions array)
 *   myCards    : array of my cards
 *   onConfirm  : ({ myCardIndex, pickedOption }) => void
 *   onSkip     : () => void   — não trocar
 */
export default function DisfarceModal({ pa, myCards, onConfirm, onSkip }) {
  const opts = pa?.disfarceOptions || [];
  const aliveCards = (myCards || []).map((c, i) => ({ ...c, index: i })).filter(c => !c.dead);

  const [pickedOption, setPickedOption] = useState(null);   // 0 | 1 | null
  const [myCardIndex, setMyCardIndex]   = useState(() => aliveCards.length === 1 ? aliveCards[0].index : null);

  const canConfirm = pickedOption !== null && myCardIndex !== null;

  return ReactDOM.createPortal(
    <AnimatePresence>
      <motion.div className={styles.overlay}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <motion.div className={styles.modal}
          initial={{ scale: 0.88, y: 30 }} animate={{ scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 280, damping: 22 }}>

          <div className={styles.header}>
            <span className={styles.icon}>🎭</span>
            <div>
              <h3 className={styles.title}>Disfarce!</h3>
              <p className={styles.desc}>
                Você tirou {opts.length} carta{opts.length !== 1 ? 's' : ''} do baralho.
                Escolha uma para trocar com uma das suas, ou recuse.
              </p>
            </div>
          </div>

          {/* Deck options */}
          <p className={styles.sectionLabel}>🃏 Opções do baralho:</p>
          <div className={styles.cardRow}>
            {opts.map((charKey, i) => {
              const cfg = CHAR_CONFIG[charKey] || {};
              const selected = pickedOption === i;
              return (
                <motion.div key={i}
                  className={`${styles.card} ${selected ? styles.cardSelectedDeck : ''}`}
                  style={{ '--char-color': cfg.color || '#ce93d8' }}
                  whileHover={{ y: -4 }} whileTap={{ scale: 0.96 }}
                  onClick={() => setPickedOption(selected ? null : i)}>
                  {cfg.img
                    ? <img src={cfg.img} alt={cfg.label} className={styles.cardImg} />
                    : <span className={styles.cardIcon}>{cfg.icon || '🃏'}</span>
                  }
                  <div className={styles.cardFooter}>
                    <span className={styles.cardName}>{cfg.label || charKey}</span>
                    {selected && <span className={styles.selectedBadge}>✓ Escolhida</span>}
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* My cards */}
          <p className={styles.sectionLabel}>🤲 Sua carta a trocar:</p>
          <div className={styles.cardRow}>
            {aliveCards.map(card => {
              const cfg = CHAR_CONFIG[card.character] || {};
              const selected = myCardIndex === card.index;
              return (
                <motion.div key={card.index}
                  className={`${styles.card} ${selected ? styles.cardSelectedMine : ''}`}
                  style={{ '--char-color': cfg.color || '#82b1ff' }}
                  whileHover={{ y: -4 }} whileTap={{ scale: 0.96 }}
                  onClick={() => setMyCardIndex(selected ? null : card.index)}>
                  {cfg.img
                    ? <img src={cfg.img} alt={cfg.label} className={styles.cardImg} />
                    : <span className={styles.cardIcon}>{cfg.icon || '🃏'}</span>
                  }
                  <div className={styles.cardFooter}>
                    <span className={styles.cardName}>{cfg.label || card.character}</span>
                    {selected && <span className={styles.selectedBadge}>✓ Trocar</span>}
                  </div>
                </motion.div>
              );
            })}
          </div>

          <div className={styles.btnRow}>
            <motion.button className={styles.confirmBtn}
              disabled={!canConfirm}
              whileTap={{ scale: 0.96 }}
              onClick={() => canConfirm && onConfirm({ myCardIndex, pickedOption })}>
              {canConfirm ? '🎭 Trocar carta' : 'Selecione uma opção e uma carta sua'}
            </motion.button>
            <motion.button className={styles.skipBtn}
              whileTap={{ scale: 0.96 }}
              onClick={onSkip}>
              🙅 Não trocar
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
