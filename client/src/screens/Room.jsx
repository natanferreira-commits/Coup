import socket from '../socket';
import styles from './Room.module.css';

export default function Room({ room, playerName }) {
  if (!room) return null;

  const isHost = socket.id === room.hostId;

  function handleStart() {
    socket.emit('start_game', {}, res => {
      if (!res?.success) alert(res?.error || 'Erro ao iniciar');
    });
  }

  function copyCode() {
    navigator.clipboard.writeText(room.code);
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h2 className={styles.gameTitle}>GOLPE</h2>

        <div className={styles.codeBox} onClick={copyCode} title="Clique para copiar">
          <span className={styles.codeLabel}>Código da sala</span>
          <span className={styles.code}>{room.code}</span>
          <span className={styles.copyHint}>clique para copiar</span>
        </div>

        <div className={styles.playerList}>
          <p className={styles.playersLabel}>Jogadores ({room.players?.length}/6)</p>
          {room.players?.map(p => (
            <div key={p.id} className={styles.playerRow}>
              <span className={styles.dot} />
              <span>{p.name}</span>
              {p.id === room.hostId && <span className={styles.hostBadge}>HOST</span>}
              {p.id === socket.id && <span className={styles.youBadge}>VOCÊ</span>}
            </div>
          ))}
        </div>

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
      </div>
    </div>
  );
}
