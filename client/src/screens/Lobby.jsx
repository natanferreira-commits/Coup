import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import socket from '../socket';
import styles from './Lobby.module.css';
import HowToPlayModal from '../components/HowToPlayModal';

const DIFFICULTIES = [
  { key: 'estagiario', emoji: '🐣', name: 'Estagiário',   bots: 2, desc: 'Joga aleatório, não sabe blefar. Bom pra aprender.' },
  { key: 'clt',        emoji: '📋', name: 'CLT',           bots: 3, desc: 'Segue as regras mas é previsível.' },
  { key: 'patrao',     emoji: '👔', name: 'Patrão',        bots: 3, desc: 'Usa as cartas direito e blefa às vezes.' },
  { key: 'deputado',   emoji: '🏛️', name: 'Deputado',      bots: 4, desc: 'Desafia suspeitos, bloqueia e blefa bastante.' },
  { key: 'dono_morro', emoji: '👑', name: 'Dono do Morro', bots: 5, desc: 'Jogo quase perfeito. Boa sorte sobreviver.' },
];

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
  const [showPve,      setShowPve]      = useState(false);
  const [pveName,      setPveName]      = useState(() => localStorage.getItem('golpe_name') || '');
  const [pveDiff,      setPveDiff]      = useState('estagiario');
  const [pveLoading,   setPveLoading]   = useState(false);

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

  function handlePvePlay() {
    if (!pveName.trim()) return;
    setPveLoading(true);
    localStorage.setItem('golpe_name', pveName.trim());

    const doCreate = () => {
      socket.emit('create_pve_room', { playerName: pveName.trim(), difficulty: pveDiff }, res => {
        setPveLoading(false);
        if (res.success) {
          setShowPve(false);
          onCreated(res.room, pveName.trim());
        } else {
          setPveLoading(false);
        }
      });
    };

    if (socket.connected) { doCreate(); return; }
    socket.connect();
    socket.once('connect', doCreate);
    socket.once('connect_error', () => setPveLoading(false));
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
        <h1 className={styles.title}>
          <span style={{ color: '#1351b4' }}>G</span>
          <span style={{ color: '#009c3b' }}>O</span>
          <span style={{ color: '#009c3b' }}>L</span>
          <span style={{ color: '#ffdf00' }}>P</span>
          <span style={{ color: '#1351b4' }}>E</span>
        </h1>
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

        <button className={styles.pveBtn} onClick={() => { setPveName(name || localStorage.getItem('golpe_name') || ''); setShowPve(true); }}>
          🤖 Jogar contra Bots (PVE)
        </button>

        <button className={styles.howToBtn} onClick={() => setShowHowTo(true)}>
          📖 Como Jogar
        </button>

        <button className={styles.backBtn} onClick={() => navigate('/')}>
          ← Voltar ao início
        </button>
      </div>

      {showHowTo && <HowToPlayModal onClose={() => setShowHowTo(false)} />}

      {/* ── Modal PVE ── */}
      {showPve && (
        <div className={styles.pveOverlay} onClick={() => setShowPve(false)}>
          <div className={styles.pveModal} onClick={e => e.stopPropagation()}>
            <div className={styles.pveHeader}>
              <h2 className={styles.pveTitle}>🤖 Jogar contra Bots</h2>
              <button className={styles.pveClose} onClick={() => setShowPve(false)}>✕</button>
            </div>
            <div className={styles.pveBody}>
              {/* Name field */}
              <div className={styles.pveNameRow}>
                <span className={styles.pveLabel}>Seu nome</span>
                <input
                  className={styles.pveNameInput}
                  placeholder="Como você quer ser chamado?"
                  value={pveName}
                  onChange={e => setPveName(e.target.value)}
                  maxLength={20}
                />
              </div>

              {/* Difficulty */}
              <div>
                <p className={styles.pveDiffLabel}>Dificuldade</p>
                <div className={styles.pveDiffGrid}>
                  {DIFFICULTIES.map(d => (
                    <button
                      key={d.key}
                      className={`${styles.pveDiffOption} ${pveDiff === d.key ? styles.pveDiffOptionActive : ''}`}
                      onClick={() => setPveDiff(d.key)}
                    >
                      <span className={styles.pveDiffEmoji}>{d.emoji}</span>
                      <span className={styles.pveDiffInfo}>
                        <span className={styles.pveDiffName}>{d.name}</span>
                        <span className={styles.pveDiffDesc}>{d.desc}</span>
                      </span>
                      <span className={styles.pveBotCount}>
                        {d.bots} bot{d.bots > 1 ? 's' : ''}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <button
                className={styles.pvePlayBtn}
                onClick={handlePvePlay}
                disabled={pveLoading || !pveName.trim()}
              >
                {pveLoading ? 'Iniciando…' : '▶ Jogar Agora'}
              </button>
            </div>
          </div>
        </div>
      )}

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
