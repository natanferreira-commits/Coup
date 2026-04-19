import { motion, AnimatePresence } from 'framer-motion';
import socket from '../socket';
import styles from './Room.module.css';

export default function Room({ room, myPlayerId, pendingRequests = [], onApprove, onDeny, onLeave }) {
  if (!room) return null;

  const isHost = myPlayerId === room.hostId;

  function handleStart() {
    socket.emit('start_game', {}, res => {
      if (!res?.success) alert(res?.error || 'Erro ao iniciar');
    });
  }

  function copyLink() {
    const url = `${window.location.origin}/sala/${room.code}`;
    navigator.clipboard.writeText(url);
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h2 className={styles.gameTitle}>GOLPE</h2>

        {/* Code / share box */}
        <div className={styles.codeBox} onClick={copyLink} title="Clique para copiar o link da sala">
          <span className={styles.codeLabel}>Código da sala</span>
          <span className={styles.code}>{room.code}</span>
          <span className={styles.copyHint}>clique para copiar o link 🔗</span>
        </div>

        {/* Player list */}
        <div className={styles.playerList}>
          <p className={styles.playersLabel}>Jogadores ({room.players?.length}/6)</p>
          {room.players?.map(p => (
            <div key={p.id} className={styles.playerRow}>
              <span className={styles.dot} />
              <span>{p.name}</span>
              {p.id === room.hostId && <span className={styles.hostBadge}>HOST</span>}
              {p.id === myPlayerId  && <span className={styles.youBadge}>VOCÊ</span>}
            </div>
          ))}
        </div>

        {/* Pending join requests — visible only to host */}
        <AnimatePresence>
          {isHost && pendingRequests.length > 0 && (
            <motion.div
              className={styles.pendingSection}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <p className={styles.pendingLabel}>⏳ Pedidos de entrada</p>
              {pendingRequests.map(req => (
                <motion.div
                  key={req.requestId}
                  className={styles.pendingRow}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  layout
                >
                  <span className={styles.pendingName}>{req.playerName}</span>
                  <div className={styles.pendingBtns}>
                    <button
                      className={styles.approveBtn}
                      onClick={() => onApprove?.(req.requestId)}
                    >✓ Aceitar</button>
                    <button
                      className={styles.denyBtn}
                      onClick={() => onDeny?.(req.requestId)}
                    >✕ Negar</button>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Start / waiting */}
        {isHost ? (
          <button
            className="btn btn-primary"
            onClick={handleStart}
            disabled={room.players?.length < 2}
            style={{ width: '100%', marginTop: 8 }}
          >
            {room.players?.length < 2 ? 'Aguardando mais jogadores...' : 'Iniciar Partida'}
          </button>
        ) : (
          <p className={styles.waiting}>Aguardando o host iniciar...</p>
        )}

        <button
          className={styles.leaveBtn}
          onClick={onLeave}
        >
          ← Sair da Sala
        </button>
      </div>
    </div>
  );
}
