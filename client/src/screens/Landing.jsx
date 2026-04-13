import { motion } from 'framer-motion';
import styles from './Landing.module.css';

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
};
const item = {
  hidden: { opacity: 0, y: 24 },
  show:   { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 200, damping: 20 } },
};

export default function Landing({ onEnter }) {
  return (
    <div className={styles.page}>
      <div className={styles.bg} />

      <motion.header className={styles.header}
        initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <span className={styles.headerTag}>🇧🇷 versão brasileira</span>
      </motion.header>

      <motion.main className={styles.main} variants={container} initial="hidden" animate="show">
        <motion.div className={styles.eyebrow} variants={item}>blefe. poder. traição.</motion.div>

        <motion.h1 className={styles.title} variants={item}>GOLPE</motion.h1>

        <motion.p className={styles.desc} variants={item}>
          Um jogo de cartas online para até 6 jogadores.<br />
          Use personagens, blefe seus amigos e seja o último de pé.
        </motion.p>

        <motion.button className={styles.cta} variants={item}
          whileHover={{ scale: 1.05, boxShadow: '0 0 70px rgba(255,214,0,0.45)' }}
          whileTap={{ scale: 0.97 }}
          onClick={onEnter}>
          Jogar agora
          <motion.span className={styles.ctaArrow}
            animate={{ x: [0, 5, 0] }} transition={{ repeat: Infinity, duration: 1.4, ease: 'easeInOut' }}>
            →
          </motion.span>
        </motion.button>

        <motion.div className={styles.chars} variants={container}>
          {CHARS.map((c, i) => (
            <motion.div key={c.name} className={styles.char} style={{ '--color': c.color }}
              variants={item}
              whileHover={{ scale: 1.1, y: -4, borderColor: c.color }}
              transition={{ type: 'spring', stiffness: 300, damping: 18 }}>
              <span className={styles.charIcon}>{c.icon}</span>
              <span className={styles.charName}>{c.name}</span>
            </motion.div>
          ))}
        </motion.div>
      </motion.main>

      <motion.footer className={styles.footer}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}>
        2–6 jogadores · online · grátis
      </motion.footer>
    </div>
  );
}

const CHARS = [
  { icon: '🏛️', name: 'Político',      color: '#1565c0' },
  { icon: '💼', name: 'Bicheiro',      color: '#e65100' },
  { icon: '🕵️', name: 'Investigador',  color: '#6a1b9a' },
  { icon: '⚖️', name: 'Juiz',          color: '#1b5e20' },
  { icon: '🔪', name: 'Miliciano',     color: '#b71c1c' },
  { icon: '🛡️', name: 'Guarda-Costas', color: '#4e342e' },
];
