import styles from './Landing.module.css';

export default function Landing({ onEnter }) {
  return (
    <div className={styles.page}>
      <div className={styles.bg} />

      <header className={styles.header}>
        <span className={styles.headerTag}>🇧🇷 versão brasileira</span>
      </header>

      <main className={styles.main}>
        <div className={styles.eyebrow}>blefe. poder. traição.</div>
        <h1 className={styles.title}>GOLPE</h1>
        <p className={styles.desc}>
          Um jogo de cartas online para até 6 jogadores.<br />
          Use personagens, blefe seus amigos e seja o último de pé.
        </p>

        <button className={styles.cta} onClick={onEnter}>
          Jogar agora
          <span className={styles.ctaArrow}>→</span>
        </button>

        <div className={styles.chars}>
          {CHARS.map(c => (
            <div key={c.name} className={styles.char} style={{ '--color': c.color }}>
              <span className={styles.charIcon}>{c.icon}</span>
              <span className={styles.charName}>{c.name}</span>
            </div>
          ))}
        </div>
      </main>

      <footer className={styles.footer}>
        2–6 jogadores · online · grátis
      </footer>
    </div>
  );
}

const CHARS = [
  { icon: '🏛️', name: 'Político',      color: '#1565c0' },
  { icon: '💼', name: 'Empresário',    color: '#e65100' },
  { icon: '🕵️', name: 'Investigador',  color: '#6a1b9a' },
  { icon: '⚖️', name: 'Juiz',          color: '#1b5e20' },
  { icon: '🔪', name: 'Assassino',     color: '#b71c1c' },
  { icon: '🛡️', name: 'Guarda-Costas', color: '#4e342e' },
];
