import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactDOM from 'react-dom';
import styles from './TutorialOverlay.module.css';

const STORAGE_KEY = 'golpe_tutorial_v1';

// ── Passos do tutorial ────────────────────────────────────────────────────────
const STEPS = [
  {
    emoji: '👑',
    title: 'Bem-vindo ao Golpe!',
    body: 'O objetivo é ser o último jogador com cartas vivas. Cada jogador começa com 2 cartas e 2 moedas.',
    highlight: null,
  },
  {
    emoji: '🃏',
    title: 'Suas Cartas = Seu Poder',
    body: 'Cada carta representa um personagem com habilidades únicas. Você pode usar qualquer ação — mesmo sem ter a carta — mas se alguém duvidar e você estiver blefando, perde uma carta!',
    highlight: null,
  },
  {
    emoji: '⚔️',
    title: 'Duvide ou Arrisque',
    body: 'Quando outro jogador declara uma ação, você pode DUVIDAR. Se ele estava blefando, ele perde uma carta. Se estava falando a verdade, você perde. Risco e recompensa!',
    highlight: null,
  },
  {
    emoji: '🎯',
    title: 'Escolha o Alvo Primeiro',
    body: 'Clique em um adversário no tabuleiro para pré-selecionar o alvo. Aí é só escolher a ação — mais rápido! O alvo selecionado aparece em vermelho.',
    highlight: null,
  },
  {
    emoji: '💥',
    title: 'Golpe de Estado',
    body: 'Com 7+ moedas você pode dar um Golpe: custa 7 moedas e elimina uma carta do alvo sem chance de bloqueio. Com 10+ moedas o Golpe é obrigatório!',
    highlight: null,
  },
];

// ── Componente principal ──────────────────────────────────────────────────────
export default function TutorialOverlay({ onClose }) {
  const [step, setStep] = useState(0);
  const isLast = step === STEPS.length - 1;

  function finish() {
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch {}
    onClose?.();
  }

  function next() {
    if (isLast) finish();
    else setStep(s => s + 1);
  }

  function prev() {
    if (step > 0) setStep(s => s - 1);
  }

  const s = STEPS[step];

  return ReactDOM.createPortal(
    <motion.div
      className={styles.overlay}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className={styles.backdrop} onClick={finish} />

      <motion.div
        className={styles.card}
        key={step}
        initial={{ opacity: 0, y: 24, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -12, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 320, damping: 24 }}
      >
        {/* Step dots */}
        <div className={styles.dots}>
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`${styles.dot}${i === step ? ` ${styles.dotActive}` : ''}`}
              onClick={() => setStep(i)}
            />
          ))}
        </div>

        {/* Emoji */}
        <motion.div
          className={styles.emoji}
          key={`emoji-${step}`}
          initial={{ scale: 0.4, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 360, damping: 18 }}
        >
          {s.emoji}
        </motion.div>

        {/* Text */}
        <h2 className={styles.title}>{s.title}</h2>
        <p className={styles.body}>{s.body}</p>

        {/* Navigation */}
        <div className={styles.nav}>
          {step > 0 ? (
            <button className={styles.btnSecondary} onClick={prev}>← Voltar</button>
          ) : (
            <button className={styles.btnSecondary} onClick={finish}>Pular tutorial</button>
          )}
          <button className={styles.btnPrimary} onClick={next}>
            {isLast ? '🎮 Vamos Jogar!' : 'Próximo →'}
          </button>
        </div>

        {/* Step counter */}
        <p className={styles.counter}>{step + 1} / {STEPS.length}</p>
      </motion.div>
    </motion.div>,
    document.body
  );
}

// ── Hook helper — retorna true se o tutorial deve ser mostrado ────────────────
export function useShouldShowTutorial() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      const seen = localStorage.getItem(STORAGE_KEY);
      if (!seen) setShow(true);
    } catch {}
  }, []);
  return [show, () => setShow(false)];
}
