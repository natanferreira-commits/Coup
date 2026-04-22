import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import ReactDOM from 'react-dom';

const COLORS = ['#ffd600', '#ff5252', '#4caf50', '#2979ff', '#ce93d8', '#ff9800', '#00e5ff', '#f06292'];
const SHAPES = ['▮', '◆', '●', '▲'];

function Confetti({ id }) {
  const x     = Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 800);
  const delay = Math.random() * 1.8;
  const dur   = 2.2 + Math.random() * 2;
  const rotEnd = Math.random() * 720 - 360;
  const size  = 7 + Math.random() * 9;
  const color = COLORS[id % COLORS.length];
  const shape = SHAPES[id % SHAPES.length];

  return (
    <motion.div
      style={{
        position: 'fixed',
        left: x,
        top: -24,
        width: size,
        height: size * 0.55,
        color,
        fontSize: size,
        lineHeight: 1,
        pointerEvents: 'none',
        zIndex: 8800,
        userSelect: 'none',
      }}
      initial={{ y: 0, rotate: 0, opacity: 1 }}
      animate={{
        y: (typeof window !== 'undefined' ? window.innerHeight : 900) + 40,
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
    setParticles(Array.from({ length: 80 }, (_, i) => i));
    // Second wave
    const t = setTimeout(() => {
      setParticles(prev => [...prev, ...Array.from({ length: 40 }, (_, i) => i + 200)]);
    }, 1200);
    return () => clearTimeout(t);
  }, [active]);

  if (!active || particles.length === 0) return null;

  return ReactDOM.createPortal(
    <>
      {particles.map(id => <Confetti key={id} id={id} />)}
    </>,
    document.body
  );
}
