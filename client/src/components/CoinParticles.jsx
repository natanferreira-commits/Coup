import { useMemo } from 'react';
import { motion } from 'framer-motion';
import moedaImg from '../assets/moeda.svg';

/**
 * CoinParticles — moedas chovendo/subindo dentro de um container
 * Props:
 *   count   : number  (default 12)
 *   mode    : 'rain'  | 'rise' | 'burst'
 *   accent  : string  (cor de brilho)
 */
export default function CoinParticles({ count = 12, mode = 'rain', accent = '#ffd600' }) {
  const coins = useMemo(() =>
    Array.from({ length: count }, (_, i) => ({
      id: i,
      x: 5 + Math.random() * 90,       // % across container
      delay: Math.random() * 1.2,
      dur: 0.9 + Math.random() * 0.8,
      size: 22 + Math.random() * 18,
      rotate: Math.random() * 360,
      rotateEnd: Math.random() * 720 - 360,
    })),
  [count]);

  const fromY = mode === 'rain' ? '-10%' : mode === 'rise' ? '110%' : '50%';
  const toY   = mode === 'rain' ? '110%'  : mode === 'rise' ? '-10%' : '50%';

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {coins.map(c => (
        <motion.img
          key={c.id}
          src={moedaImg}
          alt=""
          style={{
            position: 'absolute',
            left: `${c.x}%`,
            top: fromY,
            width: c.size,
            height: c.size,
            filter: `drop-shadow(0 0 6px ${accent}aa)`,
          }}
          animate={{
            top: [fromY, toY],
            rotate: [c.rotate, c.rotate + c.rotateEnd],
            opacity: mode === 'burst'
              ? [0, 1, 1, 0]
              : [0, 1, 1, 0.8, 0],
            scale: [0.6, 1.1, 1, 0.9, 0.7],
          }}
          transition={{
            duration: c.dur,
            delay: c.delay,
            ease: 'easeIn',
            repeat: Infinity,
            repeatDelay: Math.random() * 0.4,
          }}
        />
      ))}
    </div>
  );
}
