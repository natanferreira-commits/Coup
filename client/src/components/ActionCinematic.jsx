import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactDOM from 'react-dom';
import { CHAR_CONFIG } from './charConfig';
import CoinParticles from './CoinParticles';
import moedaImg from '../assets/moeda.svg';
import styles from './ActionCinematic.module.css';

// ── Per-action config ─────────────────────────────────────────────────────────
const CINEMATIC_CONFIG = {
  taxar:        { title: 'FAZER O L',       naturalName: 'fez o L',             sub: 'Político pegou do banco',    delta: '+3', coinMode: 'rain',  accent: '#69f0ae', charKey: 'politico'                       },
  roubar:       { title: 'COBRA A TAXA',    naturalName: 'pegou o arrego de',   sub: 'Bicheiro roubou moedas',     delta: '±2', coinMode: 'burst', accent: '#ffb74d', charKey: 'empresario'                      },
  assassinar:   { title: 'MANDOU JOGAR NO VASCO', naturalName: 'mandou pro Vasco', sub: 'Bandido elimina influência', delta: '-3', coinMode: null, accent: '#ef5350', charKey: 'assassino'                      },
  veredito:     { title: 'VEREDITO',        naturalName: 'usou Veredito em',    sub: 'O Juiz pronunciou sentença', delta: '-5', coinMode: null,    accent: '#66bb6a', charKey: 'juiz'                           },
  meter_x9:     { title: 'CAGUETOU',        naturalName: 'meteu o X9 em',       sub: 'X9 espionou uma carta',      delta: null, coinMode: null,    accent: '#ce93d8', charKey: 'investigador'                   },
  disfarce:     { title: 'DISFARCE',        naturalName: 'usou Disfarce',       sub: 'Trocou carta em segredo',    delta: null, coinMode: null,    accent: '#ce93d8', charKey: 'investigador'                   },
  trocar_carta: { title: 'TROCA FORÇADA',   naturalName: 'forçou troca em',     sub: 'Forçou troca de carta',      delta: null, coinMode: null,    accent: '#ce93d8', charKey: 'investigador'                   },
  golpe:        { title: 'GOLPE DE ESTADO', naturalName: 'deu um Golpe em',     sub: 'Eliminação direta',          delta: '-7', coinMode: null,    accent: '#ff5252', charKey: null                             },
  renda:        { title: 'TRAMPO SUADO',    naturalName: 'pegou 1 moeda',       sub: 'Pegou 1 moeda do banco',     delta: '+1', coinMode: 'rain',  accent: '#b0bec5', charKey: null                             },
  ajuda_externa:{ title: 'IMPOSTO É ROUBO', naturalName: 'pediu ajuda externa', sub: 'Pegou 2 moedas do banco',    delta: '+2', coinMode: 'rain',  accent: '#82b1ff', charKey: null                             },
};

const BG_COLORS = {
  taxar: '#061408',   roubar: '#120800',  assassinar: '#120000',
  veredito: '#021402',meter_x9: '#0d0014',disfarce: '#0d0014',
  trocar_carta: '#0d0014', golpe: '#0a0800', renda: '#080808',
  ajuda_externa: '#06080f',
};

const DURATION_MS = 4000;

/**
 * ActionCinematic — fullscreen cutscene sincronizada para todos os jogadores
 *
 * Props:
 *   cinematic : { type, actorName, targetName, claimedCharacter } | null
 *   onDismiss : () => void
 */
export default function ActionCinematic({ cinematic, onDismiss }) {
  const timerRef = useRef(null);

  useEffect(() => {
    if (!cinematic) return;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(onDismiss, DURATION_MS);
    return () => clearTimeout(timerRef.current);
  }, [cinematic, onDismiss]);

  const cfg     = cinematic ? (CINEMATIC_CONFIG[cinematic.type] || {}) : {};
  const charCfg = cfg.charKey ? CHAR_CONFIG[cfg.charKey] : null;
  const accent  = cfg.accent || '#ffd600';
  const bg      = cinematic ? (BG_COLORS[cinematic.type] || '#080808') : '#080808';

  return ReactDOM.createPortal(
    <AnimatePresence>
      {cinematic && (
        <motion.div
          className={styles.overlay}
          style={{ '--accent': accent }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onDismiss}
        >
          {/* Dark bg */}
          <div className={styles.bg} style={{ background: `radial-gradient(ellipse at 60% 50%, ${bg} 0%, rgba(4,4,8,0.97) 70%)` }} />
          <div className={styles.scanlines} />

          <div className={styles.layout}>
            {/* ── LEFT ── */}
            <div className={styles.leftSide}>
              <div className={styles.accentBorder} />

              {/* Category label */}
              {charCfg && (
                <motion.div className={styles.label}
                  initial={{ x: -30, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.05, type: 'spring', stiffness: 300 }}>
                  {charCfg.icon} {charCfg.label}
                </motion.div>
              )}

              {/* Action title */}
              <motion.h1 className={styles.title}
                initial={{ x: -60, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.08, type: 'spring', stiffness: 250, damping: 20 }}>
                {cfg.title || cinematic.type.toUpperCase()}
              </motion.h1>

              {/* Sentence: "X fez o L" / "X mandou pro Vasco em Y" */}
              <motion.div className={styles.players}
                initial={{ x: -30, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.14 }}>
                <span className={styles.actorName}>⚡ {cinematic.actorName}</span>
                <span className={styles.actionSentence}>
                  {cfg.naturalName || cfg.title?.toLowerCase() || cinematic.type}
                  {cinematic.targetName && (
                    <span className={styles.targetName}> 🎯 {cinematic.targetName}</span>
                  )}
                </span>
              </motion.div>

              {/* Coin delta */}
              {cfg.delta && (
                <motion.div className={styles.deltaBadge}
                  initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.2, type: 'spring', stiffness: 400, damping: 18 }}>
                  <img src={moedaImg} alt="" style={{ width: 26, height: 26 }} />
                  <span className={styles.deltaNum} style={{ color: cfg.delta.startsWith('+') ? '#69f0ae' : '#ef9a9a' }}>
                    {cfg.delta}
                  </span>
                  <span className={styles.deltaCoin}>moeda{cfg.delta !== '+1' && cfg.delta !== '-1' ? 's' : ''}</span>
                </motion.div>
              )}

              {/* Sub text */}
              {cfg.sub && (
                <motion.div className={styles.charPill}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  transition={{ delay: 0.28 }}>
                  {cfg.sub}
                </motion.div>
              )}

              {/* Coin particles area */}
              {cfg.coinMode && (
                <div style={{ position: 'relative', flex: 1, minHeight: 100, marginTop: 10 }}>
                  <CoinParticles count={14} mode={cfg.coinMode} accent={accent} />
                </div>
              )}
            </div>

            {/* ── RIGHT: character art / emoji ── */}
            {charCfg?.img ? (
              <div className={styles.rightSide}>
                <div className={styles.charGlow} />
                <motion.img
                  src={charCfg.img}
                  alt={charCfg.label}
                  className={styles.charImg}
                  initial={{ x: 80, opacity: 0, scale: 0.9 }}
                  animate={{ x: 0, opacity: 1, scale: 1 }}
                  transition={{ delay: 0.06, type: 'spring', stiffness: 180, damping: 22 }}
                />
              </div>
            ) : (
              /* No character: show big emoji */
              <div className={styles.rightSide} style={{ alignItems: 'center', justifyContent: 'center' }}>
                <motion.div
                  style={{ fontSize: '8rem', lineHeight: 1, filter: `drop-shadow(0 0 30px ${accent})` }}
                  initial={{ scale: 0.3, opacity: 0, rotate: -20 }}
                  animate={{ scale: 1.1, opacity: 1, rotate: 0 }}
                  transition={{ delay: 0.1, type: 'spring', stiffness: 200, damping: 16 }}>
                  {cinematic.type === 'golpe'        ? '💥' :
                   cinematic.type === 'renda'        ? '💵' :
                   cinematic.type === 'ajuda_externa' ? '💸' : '⚡'}
                </motion.div>
              </div>
            )}
          </div>

          {/* Timer bar */}
          <div className={styles.timerBar}>
            <motion.div
              className={styles.timerFill}
              style={{ background: accent }}
              initial={{ scaleX: 1 }}
              animate={{ scaleX: 0 }}
              transition={{ duration: DURATION_MS / 1000, ease: 'linear' }}
            />
          </div>

          <span className={styles.skipHint}>clique para pular</span>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
