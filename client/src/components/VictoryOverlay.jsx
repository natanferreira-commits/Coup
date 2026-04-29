import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import ReactDOM from 'react-dom';

// Brazilian flag colors first, then party colors
const COLORS = [
  '#009c3b', // verde bandeira
  '#ffdf00', // amarelo bandeira
  '#1351b4', // azul bandeira
  '#009c3b',
  '#ffdf00',
  '#ff5252', // vermelho festa
  '#ffffff',
  '#1351b4',
  '#ffdf00',
  '#009c3b',
  '#00e5ff',
  '#ff9800',
];
const SHAPES = ['▮', '◆', '●', '▲', '★', '❋'];

function Confetti({ id, wave }) {
  const x     = Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 800);
  const delay = wave * 0.6 + Math.random() * 1.4;
  const dur   = 2.0 + Math.random() * 2.5;
  const rotEnd = Math.random() * 900 - 450;
  const size  = 6 + Math.random() * 11;
  const color = COLORS[id % COLORS.length];
  const shape = SHAPES[id % SHAPES.length];
  const drift = (Math.random() - 0.5) * 120; // horizontal drift

  return (
    <motion.div
      style={{
        position: 'fixed',
        left: x,
        top: -28,
        width: size,
        height: size * 0.55,
        color,
        fontSize: size,
        lineHeight: 1,
        pointerEvents: 'none',
        zIndex: 8800,
        userSelect: 'none',
      }}
      initial={{ y: 0, x: 0, rotate: 0, opacity: 1 }}
      animate={{
        y: (typeof window !== 'undefined' ? window.innerHeight : 900) + 50,
        x: drift,
        rotate: rotEnd,
        opacity: [1, 1, 1, 0],
      }}
      transition={{
        duration: dur,
        delay,
        ease: 'easeIn',
        opacity: { times: [0, 0.5, 0.8, 1] },
      }}
    >
      {shape}
    </motion.div>
  );
}

/**
 * VictoryOverlay — confetti quando há vencedor
 * Props:
 *   active: boolean  — passa true quando winner existe
 */
export default function VictoryOverlay({ active }) {
  const [particles, setParticles] = useState([]);

  useEffect(() => {
    if (!active) { setParticles([]); return; }
    // Wave 1 — burst at start
    setParticles(Array.from({ length: 100 }, (_, i) => ({ id: i, wave: 0 })));
    // Wave 2 — 1.2s later
    const t1 = setTimeout(() => {
      setParticles(prev => [...prev, ...Array.from({ length: 60 }, (_, i) => ({ id: i + 200, wave: 1 }))]);
    }, 1200);
    // Wave 3 — 2.5s later (sustain)
    const t2 = setTimeout(() => {
      setParticles(prev => [...prev, ...Array.from({ length: 40 }, (_, i) => ({ id: i + 400, wave: 2 }))]);
    }, 2500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [active]);

  if (!active || particles.length === 0) return null;

  return ReactDOM.createPortal(
    <>
      {particles.map(p => <Confetti key={p.id} id={p.id} wave={p.wave} />)}
    </>,
    document.body
  );
}
