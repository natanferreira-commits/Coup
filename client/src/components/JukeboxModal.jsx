import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { sfx, MUSIC_TRACKS } from '../sounds/sfx';
import styles from './JukeboxModal.module.css';

export default function JukeboxModal({ onClose }) {
  // Force re-render when track changes
  const [current, setCurrent] = useState(() => sfx.getCurrentTrack());

  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  function selectTrack(id) {
    sfx.playTrack(id);
    setCurrent(id);
  }

  return (
    <AnimatePresence>
      <motion.div
        className={styles.overlay}
        key="jukebox-modal"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className={styles.modal}
          initial={{ opacity: 0, y: 16, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.96 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className={styles.header}>
            <span className={styles.title}>🎵 Música</span>
            <button className={styles.closeBtn} onClick={onClose}>✕</button>
          </div>

          {/* Track list */}
          <div className={styles.list}>
            {MUSIC_TRACKS.map(track => {
              const active = current === track.id || (!current && track.id === 'none');
              return (
                <motion.button
                  key={track.id}
                  className={`${styles.trackBtn} ${active ? styles.trackActive : ''}`}
                  onClick={() => selectTrack(track.id)}
                  whileHover={{ x: 3 }}
                  whileTap={{ scale: 0.97 }}
                >
                  <span className={styles.trackEmoji}>{track.emoji}</span>
                  <span className={styles.trackLabel}>{track.label}</span>
                  {active && track.id !== 'none' && (
                    <motion.span
                      className={styles.playingDot}
                      animate={{ opacity: [1, 0.3, 1] }}
                      transition={{ repeat: Infinity, duration: 1.1 }}
                    >▶</motion.span>
                  )}
                </motion.button>
              );
            })}
          </div>

          <p className={styles.hint}>Clique em qualquer lugar para fechar</p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
