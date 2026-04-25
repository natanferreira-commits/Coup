import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import socket from '../socket';
import styles from './Lobby.module.css';
import HowToPlayModal from '../components/HowToPlayModal';

export default function Lobby({ onCreated }) {
  const navigate  = useNavigate();
  const [name,         setName]         = useState(() => localStorage.getItem('golpe_name') || '');
  const [code,         setCode]         = useState('');
  const [error,        setError]        = useState('');
  const [loading,      setLoading]      = useState(false);
  const [loadingMsg,   setLoadingMsg]   = useState('Conectando...');
  const [showRooms,    setShowRooms]    = useState(false);
  const [roomsList,    setRoomsList]    = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [showHowTo,    setShowHowTo]    = useState(false);

  function connect(cb) {
    if (!name.trim()) return setError('Digite seu nome');
    setError('');
    setLoading(true);
    setLoadingMsg('Conectando...');

    if (socket.connected) { cb(); return; }

    socket.connect();

    const warmupTimer = setTimeout(() => {
      setLoadingMsg('Servidor acordando, aguarde (~30s)...');
    }, 4000);

    function onConnect()   { cleanup(); cb(); }
    function onError()     {
      cleanup();
      setLoading(false);
      const isLocalhost = (import.meta.env.VITE_SERVER_URL || '').includes('localhost');
      setError(isLocalhost
        ? 'Servidor offline. Rode o servidor (npm run dev na pasta /server).'
        : 'Não foi possível conectar. Tente novamente em alguns segundos.'
      );
    }
    function cleanup() {
      clearTimeout(warmupTimer);
      socket.off('connect',       onConnect);
      socket.off('connect_error', onError);
    }

    socket.once('connect',       onConnect);
    socket.once('connect_error', onError);
  }

  function handleCreate() {
    connect(() => {
      localStorage.setItem('golpe_name', name.trim());
      socket.emit('create_room', { playerName: name.trim() }, res => {
        setLoading(false);
        if (res.success) {
          onCreated(res.room, name.trim());
        } else {
          setError(res.error || 'Erro ao criar sala');
        }
      });
    });
  }

  function handleJoin() {
    if (!code.trim()) return setError('Digite o código da sala');
    if (!name.trim()) return setError('Digite seu nome');
    localStorage.setItem('golpe_name', name.trim());
    navigate(`/sala/${code.trim().toUpperCase()}`, { state: { playerName: name.trim() } });
  }

  function handleListRooms() {
    setLoadingRooms(true);
    setRoomsList([]);

    const doList = () => {
      socket.emit('list_rooms', {}, res => {
        setLoadingRooms(false);
        if (res?.success) {
          setRoomsList(res.rooms);
          setShowRooms(true);
        }
      });
    };

    if (socket.connected) {
      doList();
    } else {
      socket.connect();
      socket.once('connect', doList);
      socket.once('connect_error', () => {
        setLoadingRooms(false);
        setError('Não foi possível conectar.');
      });
    }
  }

  function joinRoom(roomCode) {
    if (!name.trim()) {
      setShowRooms(false);
      setError('Digite seu nome primeiro');
      return;
    }
    localStorage.setItem('golpe_name', name.trim());
    navigate(`/sala/${roomCode}`, { state: { playerName: name.trim() } });
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>GOLPE</h1>
        <p className={styles.subtitle}>Blefe. Poder. Traição.</p>

        <div className={styles.form}>
          <input
            placeholder="Seu nome"
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={20}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
          />

          <button className="btn btn-primary" onClick={handleCreate} disabled={loading}>
            {loading ? loadingMsg : 'Criar Sala'}
          </button>

          <div className={styles.divider}><span>ou entre em uma sala</span></div>

          <input
            placeholder="Código da sala (ex: AB3K)"
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            maxLength={4}
            onKeyDown={e => e.key === 'Enter' && handleJoin()}
          />

          <div className={styles.joinRow}>
            <button className="btn" style={{ flex: 1 }} onClick={handleJoin} disabled={loading}>
              Entrar na Sala
            </button>
            <button
              className={`btn ${styles.salasBtn}`}
              onClick={handleListRooms}
              disabled={loadingRooms}
              title="Ver salas abertas"
            >
              {loadingRooms ? '…' : '🏛️ Salas'}
            </button>
          </div>

          {error && <p className={styles.error}>{error}</p>}
        </div>

        <button className={styles.howToBtn} onClick={() => setShowHowTo(true)}>
          📖 Como Jogar
        </button>

        <button className={styles.backBtn} onClick={() => navigate('/')}>
          ← Voltar ao início
        </button>
      </div>

      {showHowTo && <HowToPlayModal onClose={() => setShowHowTo(false)} />}

      {/* ── Modal de salas abertas ── */}
      {showRooms && (
        <div className={styles.roomsOverlay} onClick={() => setShowRooms(false)}>
          <div className={styles.roomsModal} onClick={e => e.stopPropagation()}>
            <div className={styles.roomsHeader}>
              <h2 className={styles.roomsTitle}>🏛️ Salas Abertas</h2>
              <div className={styles.roomsHeaderBtns}>
                <button className={styles.roomsRefresh} onClick={handleListRooms} title="Atualizar">
                  🔄
                </button>
                <button className={styles.roomsClose} onClick={() => setShowRooms(false)}>
                  ✕
                </button>
              </div>
            </div>

            {loadingRooms ? (
              <p className={styles.roomsEmpty}>Carregando...</p>
            ) : roomsList.length === 0 ? (
              <p className={styles.roomsEmpty}>Nenhuma sala aberta no momento 😴</p>
            ) : (
              <div className={styles.roomsList}>
                {roomsList.map(r => (
                  <div key={r.code} className={styles.roomsItem}>
                    <span className={styles.roomsCode}>{r.code}</span>
                    <div className={styles.roomsInfo}>
                      <span className={styles.roomsHost}>{r.hostName}</span>
                      <span className={styles.roomsMeta}>
                        👥 {r.playerCount}/6
                        {r.status === 'playing'
                          ? <span className={styles.roomsPlaying}>🟡 Em andamento</span>
                          : <span className={styles.roomsWaiting}>🟢 Aguardando</span>
                        }
                        {r.eventsEnabled && <span className={styles.roomsTiktok}>🎉 TikTok</span>}
                      </span>
                    </div>
                    <button
                      className={`btn btn-primary ${styles.roomsJoinBtn}`}
                      onClick={() => joinRoom(r.code)}
                    >
                      Entrar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
