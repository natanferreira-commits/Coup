import styles from './Card.module.css';

const CHAR_CONFIG = {
  politico:      { label: 'Político',      color: '#1565c0', icon: '🏛️', desc: '+3 moedas' },
  empresario:    { label: 'Empresário',    color: '#e65100', icon: '💼', desc: 'Rouba 2 moedas' },
  investigador:  { label: 'Investigador',  color: '#6a1b9a', icon: '🕵️', desc: 'Investiga / Troca' },
  juiz:          { label: 'Juiz',          color: '#1b5e20', icon: '⚖️', desc: 'Bloqueia roubo/investigação' },
  assassino:     { label: 'Assassino',     color: '#b71c1c', icon: '🔪', desc: 'Elimina por 3 moedas' },
  guarda_costas: { label: 'Guarda-Costas', color: '#4e342e', icon: '🛡️', desc: 'Bloqueia assassinato/roubo' },
};

export default function Card({ character, dead = false, hidden = false, onClick, selected }) {
  if (dead) {
    return (
      <div className={`${styles.card} ${styles.dead}`}>
        <span className={styles.deadLabel}>ELIMINADO</span>
        {character && <span className={styles.deadChar}>{CHAR_CONFIG[character]?.label}</span>}
      </div>
    );
  }

  if (hidden) {
    return (
      <div className={`${styles.card} ${styles.hidden} ${selected ? styles.selected : ''}`} onClick={onClick}>
        <div className={styles.hiddenBack}>
          <span className={styles.hiddenIcon}>🃏</span>
          <span className={styles.hiddenLabel}>GOLPE</span>
        </div>
      </div>
    );
  }

  const cfg = CHAR_CONFIG[character] || { label: character, color: '#333', icon: '?', desc: '' };

  return (
    <div
      className={`${styles.card} ${selected ? styles.selected : ''}`}
      style={{ '--char-color': cfg.color }}
      onClick={onClick}
    >
      <div className={styles.cardInner}>
        <div className={styles.cardHeader}>
          <span className={styles.icon}>{cfg.icon}</span>
        </div>
        <div className={styles.cardBody}>
          <span className={styles.name}>{cfg.label}</span>
          <span className={styles.desc}>{cfg.desc}</span>
        </div>
        <div className={styles.stripe} />
      </div>
    </div>
  );
}

export { CHAR_CONFIG };
