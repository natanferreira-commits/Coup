import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import socket from '../socket';
import Card from '../components/Card';
import { CHAR_CONFIG } from '../components/charConfig';
import GameLog from '../components/GameLog';
import TurnCard from '../components/TurnCard';
import CardSelectorModal from '../components/CardSelectorModal';
import { useSoundEffects } from '../sounds/useSoundEffects';
import { sfx } from '../sounds/sfx';
import moedaImg from '../assets/moeda.svg';
import mesaImg  from '../assets/mesa.svg';
import styles from './Game.module.css';

// ── Constants ─────────────────────────────────────────────────────────────────

const ACTION_NAMES = {
  renda:'Trampo Suado', ajuda_externa:'Imposto é Roubo', golpe:'Golpe de Estado',
  taxar:'Faz o L', roubar:'Pegar o Arrego', assassinar:'Mandar pro Vasco',
  veredito:'Veredito',
  meter_x9:'Meter o X9', disfarce:'Disfarce', trocar_carta:'Troca de Cartas',
};

const ACTION_ICONS = {
  renda:'💵', ajuda_externa:'💸', golpe:'💥',
  taxar:'🏛️', roubar:'💼', assassinar:'🔫',
  veredito:'⚖️', meter_x9:'🕵️', disfarce:'🎭', trocar_carta:'🔄',
};

const TARGET_ACTIONS = ['golpe','roubar','assassinar','veredito','meter_x9','trocar_carta'];

const BLOCK_OPTIONS = {
  ajuda_externa:['politico'], roubar:['juiz','guarda_costas'],
  assassinar:['guarda_costas'], meter_x9:['juiz'], disfarce:['juiz'], trocar_carta:['juiz'],
};

// Which character an action belongs to (null = basic, no character)
const ACTION_TO_CHAR = {
  taxar:'politico', roubar:'empresario',
  assassinar:'assassino', veredito:'juiz',
  meter_x9:'investigador', disfarce:'investigador', trocar_carta:'investigador',
};

// Action categories shown in the right panel — agrupadas por personagem
const ACTION_CATEGORIES = [
  {
    id: 'basicas', label: '⚡ Básicas', labelColor: 'var(--muted)', bg: 'transparent', charKey: null,
    actions: [
      { action:'renda',         icon:'💵', label:'Trampo Suado',    sub:'+1 moeda',          tooltip:'Pega 1 moeda do banco. Não pode ser bloqueada nem duvidada.' },
      { action:'ajuda_externa', icon:'💸', label:'Imposto é Roubo', sub:'+2 moedas',          tooltip:'Pega 2 moedas. Qualquer Político pode bloquear.' },
      { action:'golpe',         icon:'💥', label:'Golpe de Estado',  sub:'7💰 · alvo obrig.', tooltip:'Gasta 7 moedas e elimina uma carta do alvo. Obrigatório com 10+ moedas.' },
    ],
  },
  {
    id: 'politico', label: '🏛️ Político', labelColor: '#1565c0', bg: 'rgba(21,101,192,0.04)', charKey: 'politico',
    actions: [
      { action:'taxar', icon:'🏛️', label:'Faz o L', sub:'+3 moedas', tooltip:'Afirma ser o Político. Pega 3 moedas. Qualquer um pode duvidar.' },
    ],
  },
  {
    id: 'empresario', label: '💼 Bicheiro', labelColor: '#e65100', bg: 'rgba(230,81,0,0.04)', charKey: 'empresario',
    actions: [
      { action:'roubar', icon:'💼', label:'Pegar o Arrego', sub:'Rouba 2 moedas', tooltip:'Afirma ser o Bicheiro. Rouba 2 moedas do alvo. Juiz ou Miliciano podem bloquear (custa 1 moeda + cara ou coroa).' },
    ],
  },
  {
    id: 'assassino', label: '🔫 Bandido', labelColor: '#b71c1c', bg: 'rgba(183,28,28,0.04)', charKey: 'assassino',
    actions: [
      { action:'assassinar', icon:'🔫', label:'Mandar pro Vasco', sub:'Elimina · 3💰', tooltip:'Afirma ser o Bandido. Gasta 3 moedas e elimina carta do alvo. O Miliciano pode bloquear.' },
    ],
  },
  {
    id: 'juiz', label: '⚖️ Juiz', labelColor: '#1b5e20', bg: 'rgba(27,94,32,0.04)', charKey: 'juiz',
    actions: [
      { action:'veredito', icon:'⚖️', label:'Veredito', sub:'Condena · 5💰', tooltip:'Afirma ser o Juiz. Gasta 5 moedas. Acusa o alvo de ter uma carta específica. Se acertar o alvo perde a carta; se errar você perde as moedas. Qualquer um pode duvidar.' },
    ],
  },
  {
    id: 'investigador', label: '🕵️ X9', labelColor: '#6a1b9a', bg: 'rgba(106,27,154,0.04)', charKey: 'investigador',
    actions: [
      { action:'meter_x9',     icon:'🕵️', label:'Meter o X9',      sub:'Espia carta',   tooltip:'Afirma ser o X9. Vê uma carta secreta do alvo. Juiz pode bloquear.' },
      { action:'disfarce',     icon:'🎭', label:'Disfarce',          sub:'Troca sua carta', tooltip:'Afirma ser o X9. Troca uma de suas cartas pelo baralho em segredo. Juiz pode bloquear.' },
      { action:'trocar_carta', icon:'🔄', label:'Troca de Cartas',   sub:'Força troca',   tooltip:'Afirma ser o X9. Força o alvo a trocar uma carta. Juiz pode bloquear.' },
    ],
  },
];

export default function Game({ data, myId }) {
  const [selectedTarget,   setSelectedTarget]   = useState(null);
  const [pendingConfirm,   setPendingConfirm]   = useState(null);
  const [blockChar,        setBlockChar]        = useState(null);
  const [vereditoChar,     setVereditoChar]     = useState(null);
  const [error,            setError]            = useState('');
  const [showHelp,         setShowHelp]         = useState(false);
  const [timeLeft,         setTimeLeft]         = useState(30);
  const [coinAnimating,    setCoinAnimating]    = useState(false); // 3s animation after flip
  const [actionNotif,      setActionNotif]      = useState(null);

  const game = data?.game;
  const { players, currentPlayerId, phase, pendingAction: pa, log, winner } = game || {};

  // ── Sound effects ──────────────────────────────────────────────────────────
  useSoundEffects(game, myId);

  // ── Turn timer countdown ──────────────────────────────────────────────────
  useEffect(() => {
    if (!data?.timerStartedAt || !phase || phase === 'GAME_OVER') { setTimeLeft(30); return; }
    const update = () => {
      const elapsed = (Date.now() - data.timerStartedAt) / 1000;
      setTimeLeft(Math.max(0, Math.round(30 - elapsed)));
    };
    update();
    const interval = setInterval(update, 500);
    return () => clearInterval(interval);
  }, [data?.timerStartedAt, phase]);

  // ── Coin flip: 5s girando + 5s resultado, depois ator confirma ──────────────
  const prevCoinFlipResult = useRef(null);
  const prevActionKeyRef = useRef(null);
  useEffect(() => {
    if (pa?.coinFlipResult && pa.coinFlipResult !== prevCoinFlipResult.current) {
      prevCoinFlipResult.current = pa.coinFlipResult;
      setCoinAnimating(true);
      // Após 5s, para a animação e mostra o resultado
      const t1 = setTimeout(() => setCoinAnimating(false), 5000);
      // Após 10s (5s girando + 5s resultado), ator confirma automaticamente
      const t2 = setTimeout(() => {
        if (pa.actorId === myId) socket.emit('acknowledge_coin_flip', {});
      }, 10000);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
  }, [pa?.coinFlipResult, myId]);

  // ── Action announcement popup ─────────────────────────────────────────────
  useEffect(() => {
    if (!pa?.type || !pa?.actorId) return;
    const key = `${pa.actorId}:${pa.type}`;
    if (key === prevActionKeyRef.current) return;
    prevActionKeyRef.current = key;
    const actorP = players?.find(p => p.id === pa.actorId);
    const targetP = pa.targetId ? players?.find(p => p.id === pa.targetId) : null;
    setActionNotif({
      type: pa.type,
      icon: ACTION_ICONS[pa.type] || '⚡',
      label: ACTION_NAMES[pa.type],
      actorName: actorP?.name,
      targetName: targetP?.name,
      claimedCharacter: pa.claimedCharacter,
    });
    const t = setTimeout(() => setActionNotif(null), 3000);
    return () => clearTimeout(t);
  }, [pa?.actorId, pa?.type]);

  // Reset on phase change
  useEffect(() => {
    setPendingConfirm(null);
    setBlockChar(null);
    setVereditoChar(null);
    setError('');
    prevCoinFlipResult.current = null;
    setCoinAnimating(false);
    prevActionKeyRef.current = null;
    setActionNotif(null);
  }, [phase]);

  if (!game) return <div className={styles.loading}>Carregando...</div>;

  const me       = players.find(p => p.id === myId);
  const others   = players.filter(p => p.id !== myId);
  const isMyTurn = currentPlayerId === myId;
  const myCoins  = me?.coins ?? 0;

  function emit(event, payload, cb) {
    setError('');
    socket.emit(event, payload ?? {}, res => {
      if (res && !res.success) setError(res.error || 'Erro desconhecido');
      cb?.();
    });
  }

  // Stage action for confirmation instead of firing immediately
  const stageAction = (action, charKey) => {
    if (TARGET_ACTIONS.includes(action) && !selectedTarget)
      return setError('Selecione um oponente como alvo primeiro ⬆');
    sfx.cardFlip();
    setPendingConfirm({ action, charKey: charKey ?? null, targetId: selectedTarget });
  };

  const confirmAction = () => {
    if (!pendingConfirm) return;
    if (pendingConfirm.action === 'veredito' && !pendingConfirm.vereditoChar)
      return setError('Selecione qual carta você acusa o alvo de ter ⬇');
    sfx.action();
    emit('take_action', {
      action: pendingConfirm.action,
      targetId: pendingConfirm.targetId,
      accusedCharacter: pendingConfirm.vereditoChar || undefined,
    }, () => {
      setSelectedTarget(null);
      setPendingConfirm(null);
      setVereditoChar(null);
    });
  };

  const cancelConfirm = () => {
    setPendingConfirm(null);
    setError('');
  };

  const iAmActor         = pa?.actorId === myId;
  const iAmTarget        = pa?.targetId === myId;
  const alreadyResponded = pa?.respondedPlayers?.includes(myId);
  const iAmInLoseQueue   = pa?.loseInfluenceQueue?.[0]?.playerId === myId;
  const iAmSwapPlayer    = pa?.swapPlayerId === myId;
  const iAmBlocker       = pa?.blocker?.playerId === myId;

  const canAct            = isMyTurn && phase === 'ACTION_SELECT' && me?.alive;
  const canRespond        = phase === 'RESPONSE_WINDOW' && !iAmActor && !alreadyResponded && me?.alive;
  const isTargetedAction  = TARGET_ACTIONS.includes(pa?.type);
  // Veredito permite qualquer jogador duvidar (anyoneCanChallenge)
  const isAnyoneChallenge = pa?.type === 'veredito';
  const canChallengeAct   = canRespond && !!pa?.claimedCharacter && (!isTargetedAction || iAmTarget || isAnyoneChallenge);
  const canBlockAct       = canRespond && (pa?.type === 'ajuda_externa' ? true : iAmTarget);
  const canChallengeBlock = phase === 'BLOCK_CHALLENGE_WINDOW' && iAmActor;
  // Para veredito: não-alvo pode passar para não travar a resposta
  const canPassForVeredito = canRespond && isAnyoneChallenge && !iAmTarget && !iAmActor;

  const mustLoseInfluence   = phase === 'LOSE_INFLUENCE'   && iAmInLoseQueue;
  const mustShowCard        = phase === 'X9_PEEK_SELECT'   && iAmTarget;
  const mustAcknowledgePeek = phase === 'X9_PEEK_VIEW'    && iAmActor;
  const mustSwapCard        = phase === 'CARD_SWAP_SELECT' && iAmSwapPlayer;
  const mustAckCoinFlip     = phase === 'COIN_FLIP'        && iAmActor;
  const mustChooseChallengeWon = phase === 'CHALLENGE_WON' && iAmActor;
  const isHost              = data?.hostId === myId;

  const blockOptions = pa ? (BLOCK_OPTIONS[pa.type] || []) : [];
  const actorName    = pa ? players.find(p => p.id === pa.actorId)?.name  : null;
  const targetName   = pa?.targetId ? players.find(p => p.id === pa.targetId)?.name : null;
  const blockerName  = pa?.blocker  ? players.find(p => p.id === pa.blocker.playerId)?.name : null;

  // Which character card to highlight in the fingir grid
  const activeChar = pendingConfirm?.charKey ?? null;

  // ── Game over ────────────────────────────────────────────────────────────────
  if (winner) {
    const w = players.find(p => p.id === winner);
    const losers = players.filter(p => p.id !== winner);
    return (
      <motion.div className={styles.gameOver} initial={{ opacity:0 }} animate={{ opacity:1 }}>
        <div className={styles.gameOverLayout}>
          {/* Painel central: vencedor + perdedores */}
          <motion.div className={styles.gameOverCard}
            initial={{ scale:0.7, y:40 }} animate={{ scale:1, y:0 }}
            transition={{ type:'spring', stiffness:200, damping:18 }}>
            <div className={styles.crownIcon}>👑</div>
            <h1 className={styles.winnerName}>{w?.name}</h1>
            <p className={styles.winnerSub}>venceu o Golpe! 🇧🇷</p>

            {losers.length > 0 && (
              <div className={styles.losersList}>
                <p className={styles.losersTitle}>Eliminados:</p>
                {losers.map(p => (
                  <div key={p.id} className={styles.loserRow}>
                    <span className={styles.loserAvatar}>{p.name.charAt(0).toUpperCase()}</span>
                    <span className={styles.loserName}>{p.name}</span>
                    <div className={styles.loserCards}>
                      {p.cards.map((c,i) => (
                        <span key={i} className={styles.loserCard}>
                          {c.dead ? (CHAR_CONFIG[c.character]?.icon || '💀') : '🃏'}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {isHost && (
              <motion.button className="btn btn-primary" style={{marginTop:20,width:'100%'}}
                whileTap={{ scale:0.95 }} onClick={() => socket.emit('restart_game', {})}>
                🔄 Jogar Novamente
              </motion.button>
            )}
            {!isHost && (
              <p style={{color:'var(--muted)',fontSize:13,marginTop:12}}>Aguardando o host reiniciar...</p>
            )}
          </motion.div>

          {/* Chat da rodada */}
          <motion.div className={styles.gameOverLog}
            initial={{ opacity:0, x:30 }} animate={{ opacity:1, x:0 }}
            transition={{ delay:0.3 }}>
            <p className={styles.gameOverLogTitle}>📜 Histórico da Partida</p>
            <div className={styles.gameOverLogScroll}>
              {(log || []).map((msg, i) => (
                <p key={i} className={styles.gameOverLogMsg}>{msg}</p>
              ))}
            </div>
          </motion.div>
        </div>
      </motion.div>
    );
  }

  return (
    <>
    {/* Action notification overlay */}
    <AnimatePresence>
      {actionNotif&&(
        <motion.div className={styles.actionNotifOverlay}
          initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0,scale:0.9}}>
          <motion.div className={styles.actionNotifCard}
            initial={{scale:0.5,y:-40}} animate={{scale:1,y:0}}
            exit={{scale:0.85,opacity:0}}
            transition={{type:'spring',stiffness:420,damping:26}}>
            <span className={styles.actionNotifIcon}>{actionNotif.icon}</span>
            <span className={styles.actionNotifLabel}>{actionNotif.label}</span>
            <div className={styles.actionNotifPlayers}>
              <span style={{color:'#82b1ff'}}>{actionNotif.actorName}</span>
              {actionNotif.targetName&&(
                <><span style={{color:'var(--muted)'}}> → </span>
                <span style={{color:'#ef9a9a'}}>{actionNotif.targetName}</span></>
              )}
            </div>
            {actionNotif.claimedCharacter&&(
              <div className={styles.actionNotifChar}>
                {CHAR_CONFIG[actionNotif.claimedCharacter]?.icon}{' '}
                {CHAR_CONFIG[actionNotif.claimedCharacter]?.label}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    <div className={styles.board}>

      {/* ── Modals ── */}
      {mustLoseInfluence && (
        <CardSelectorModal context="lose" title="Perdeu, mané 💀"
          description="Você deve perder uma carta. Escolha qual revelar para a mesa."
          cards={me?.cards||[]} confirmLabel="Perder"
          onConfirm={i => emit('lose_influence',{cardIndex:i})} />
      )}
      {mustShowCard && (
        <CardSelectorModal context="show" title="O X9 tá de olho 👀"
          description={`${actorName} meteu o X9 em você. Escolha uma carta para mostrar APENAS a ele.`}
          cards={me?.cards||[]} confirmLabel="Mostrar"
          onConfirm={i => emit('select_card_show',{cardIndex:i})} />
      )}
      {mustSwapCard && (
        <CardSelectorModal context="swap"
          title={pa?.swapContext==='disfarce'?'Hora do Disfarce 🎭':'Troca Forçada 🔄'}
          description={pa?.swapContext==='disfarce'
            ?'Escolha uma carta para trocar pelo baralho.'
            :`${actorName} forçou uma troca. Escolha qual carta trocar.`}
          cards={me?.cards||[]} confirmLabel="Trocar"
          onConfirm={i => emit('select_card_swap',{cardIndex:i})} />
      )}

      {/* ── LEFT ── */}
      <div className={styles.leftPanel}>
        <TurnCard player={players.find(p=>p.id===currentPlayerId)} isMe={isMyTurn} />
        <p className={styles.panelLabel}>Chat da Rodada</p>
        <GameLog log={log} />
      </div>

      {/* ── CENTER ── */}
      <div className={styles.center}>

        {/* Opponents */}
        <div className={styles.opponents}>
          {others.map(p => (
            <motion.div key={p.id}
              className={`${styles.opponent}
                ${p.id===currentPlayerId?styles.opponentActive:''}
                ${!p.alive?styles.opponentDead:''}
                ${selectedTarget===p.id?styles.opponentTargeted:''}
              `}
              whileHover={canAct&&p.alive?{scale:1.03,y:-2}:{}}
              whileTap={canAct&&p.alive?{scale:0.97}:{}}
              onClick={()=>canAct&&p.alive&&setSelectedTarget(prev=>prev===p.id?null:p.id)}
              style={{cursor:canAct&&p.alive?'pointer':'default'}}>
              <div className={styles.opponentAvatar}>{p.name.charAt(0).toUpperCase()}</div>
              <div className={styles.opponentInfo}>
                <span className={styles.opponentName}>{p.name}</span>
                <div className={styles.opponentCoins}>
                  <img src={moedaImg} className={styles.coinIconSm} alt="" />
                  <span>{p.coins}</span>
                </div>
              </div>
              <div className={styles.opponentCards}>
                {p.cards.map((c,i)=>{
                  const cfg = CHAR_CONFIG[c.character] || {};
                  return (
                    <div key={i} className={`${styles.playerCard} ${c.dead?styles.playerCardDead:''}`}>
                      {c.dead ? (
                        cfg.img
                          ? <img src={cfg.img} className={styles.playerCardImg} alt={cfg.label}/>
                          : <span className={styles.playerCardFallback}>{cfg.icon||'?'}</span>
                      ) : (
                        <div className={styles.playerCardBack}>🃏</div>
                      )}
                      {c.dead&&<div className={styles.playerCardDeadBadge}>💀 {cfg.label}</div>}
                    </div>
                  );
                })}
              </div>
              {p.id===currentPlayerId&&<div className={styles.turnBadge}>VEZ</div>}
              {selectedTarget===p.id&&<div className={styles.targetBadge}>ALVO</div>}
            </motion.div>
          ))}
        </div>

        {/* Mesa */}
        <div className={styles.mesaWrapper}>
          <AnimatePresence mode="wait">

            {phase==='ACTION_SELECT'&&(
              <motion.div key="sel" className={styles.mesaStatus}
                initial={{opacity:0,y:-6}} animate={{opacity:1,y:0}} exit={{opacity:0}}>
                {isMyTurn
                  ?<span className={styles.mesaStatusMain} style={{color:'var(--yellow)'}}>✦ SUA VEZ — escolha uma ação</span>
                  :<span className={styles.mesaStatusMain}>{players.find(p=>p.id===currentPlayerId)?.name} está pensando...</span>
                }
              </motion.div>
            )}

            {(phase==='RESPONSE_WINDOW'||phase==='BLOCK_CHALLENGE_WINDOW')&&pa&&(
              <motion.div key="resp" className={styles.mesaStatus}
                initial={{opacity:0,y:-6}} animate={{opacity:1,y:0}} exit={{opacity:0}}>
                <span className={styles.mesaStatusIcon}>{pa.claimedCharacter?CHAR_CONFIG[pa.claimedCharacter]?.icon:'⚡'}</span>
                <span className={styles.mesaStatusMain}>{ACTION_NAMES[pa.type]}</span>
                <span className={styles.mesaStatusSub}>
                  <span style={{color:'#82b1ff'}}>{actorName}</span>
                  {targetName&&<>{' → '}<span style={{color:'#ef9a9a'}}>{targetName}</span></>}
                </span>
                {phase==='BLOCK_CHALLENGE_WINDOW'&&pa.blocker&&(
                  <span className={styles.mesaStatusBlock}>🛡️ {blockerName} bloqueou</span>
                )}
              </motion.div>
            )}

            {phase==='LOSE_INFLUENCE'&&(
              <motion.div key="lose" className={styles.mesaStatus}
                initial={{opacity:0,y:-6}} animate={{opacity:1,y:0}} exit={{opacity:0}}>
                <span className={styles.mesaStatusIcon}>💀</span>
                <span className={styles.mesaStatusMain} style={{color:'var(--red)'}}>
                  {players.find(p=>p.id===pa?.loseInfluenceQueue?.[0]?.playerId)?.name} perde uma carta
                </span>
              </motion.div>
            )}

            {(phase==='X9_PEEK_SELECT'||phase==='X9_PEEK_VIEW')&&(
              <motion.div key="x9" className={styles.mesaStatus}
                initial={{opacity:0,y:-6}} animate={{opacity:1,y:0}} exit={{opacity:0}}>
                <span className={styles.mesaStatusIcon}>🕵️</span>
                <span className={styles.mesaStatusMain} style={{color:'#ce93d8'}}>X9 em ação</span>
                <span className={styles.mesaStatusSub}>
                  <span style={{color:'#82b1ff'}}>{actorName}</span>{' → '}
                  <span style={{color:'#ef9a9a'}}>{targetName}</span>
                </span>
              </motion.div>
            )}

            {phase==='CARD_SWAP_SELECT'&&(
              <motion.div key="swap" className={styles.mesaStatus}
                initial={{opacity:0,y:-6}} animate={{opacity:1,y:0}} exit={{opacity:0}}>
                <span className={styles.mesaStatusIcon}>🔄</span>
                <span className={styles.mesaStatusMain} style={{color:'#82b1ff'}}>
                  {pa?.swapContext==='disfarce'?'Disfarce':'Troca de Cartas'}
                </span>
                <span className={styles.mesaStatusSub}>
                  {players.find(p=>p.id===pa?.swapPlayerId)?.name} escolhe uma carta
                </span>
              </motion.div>
            )}

            {phase==='CHALLENGE_WON'&&pa&&(
              <motion.div key="chalwon" className={styles.mesaStatus}
                initial={{opacity:0,y:-6}} animate={{opacity:1,y:0}} exit={{opacity:0}}>
                <span className={styles.mesaStatusIcon}>✅</span>
                <span className={styles.mesaStatusMain} style={{color:'#4caf50'}}>Duvidada Falhou!</span>
                <span className={styles.mesaStatusSub}>
                  <span style={{color:'#82b1ff'}}>{actorName}</span> provou ter{' '}
                  {pa.challengeWonCharacter&&(
                    <span style={{color:'var(--yellow)'}}>{CHAR_CONFIG[pa.challengeWonCharacter]?.icon} {CHAR_CONFIG[pa.challengeWonCharacter]?.label}</span>
                  )}
                </span>
              </motion.div>
            )}

          </AnimatePresence>

          {phase==='COIN_FLIP'&&(
            <motion.div key="coinflip" className={styles.mesaStatus}
              initial={{opacity:0,y:-6}} animate={{opacity:1,y:0}} exit={{opacity:0}}>
              {!pa?.coinFlipResult&&(
                <>
                  <motion.span className={styles.mesaStatusIcon}
                    animate={{scale:[1,1.15,1]}} transition={{repeat:Infinity,duration:1.2}}>🪙</motion.span>
                  <span className={styles.mesaStatusMain}>Cara ou Coroa!</span>
                  <span className={styles.mesaStatusSub}>{blockerName} vai jogar a moeda...</span>
                </>
              )}
              {pa?.coinFlipResult&&coinAnimating&&(
                <>
                  <motion.span style={{fontSize:'2rem',display:'block'}}
                    animate={{rotateY:360}} transition={{repeat:Infinity,duration:0.35,ease:'linear'}}>🪙</motion.span>
                  <span className={styles.mesaStatusMain}>Girando...</span>
                </>
              )}
              {pa?.coinFlipResult&&!coinAnimating&&(
                <>
                  <span className={styles.mesaStatusIcon}>🪙</span>
                  <span className={styles.mesaStatusMain} style={{
                    color: pa.coinFlipResult==='cara' ? '#4caf50' : '#f44336', fontSize:22,
                  }}>
                    {pa.coinFlipResult==='cara' ? '🦅 CARA' : '🐉 COROA'}
                  </span>
                  <span className={styles.mesaStatusSub}>
                    {pa.coinFlipResult==='cara' ? 'Bloqueio aprovado!' : 'Bloqueio cancelado!'}
                  </span>
                </>
              )}
            </motion.div>
          )}

          {/* Timer countdown */}
          {phase&&phase!=='GAME_OVER'&&data?.timerStartedAt&&(
            <div className={styles.timerWrapper}>
              <div className={styles.timerFill} style={{
                width:`${Math.round((timeLeft/30)*100)}%`,
                background: timeLeft<=10?'var(--red)':timeLeft<=20?'#ffd600':'#4caf50',
              }}/>
              <span className={styles.timerNum}
                style={{color: timeLeft<=10?'var(--red)':timeLeft<=20?'#ffd600':'#aaa'}}>
                {timeLeft}s
              </span>
            </div>
          )}

          <motion.img src={mesaImg} className={styles.mesaImg} alt="mesa"
            animate={
              phase==='RESPONSE_WINDOW'       ?{filter:'brightness(1.15) drop-shadow(0 0 18px #ffd60088)'}:
              phase==='BLOCK_CHALLENGE_WINDOW' ?{filter:'brightness(1.1) drop-shadow(0 0 18px #f4433688)'}:
              phase==='LOSE_INFLUENCE'         ?{filter:'brightness(1.05) drop-shadow(0 0 16px #f4433666)'}:
              phase==='COIN_FLIP'              ?{filter:'brightness(1.15) drop-shadow(0 0 20px #ffd60099)'}:
              phase==='X9_PEEK_SELECT'         ?{filter:'brightness(1.1) drop-shadow(0 0 18px #9c27b088)'}:
              phase==='X9_PEEK_VIEW'           ?{filter:'brightness(1.1) drop-shadow(0 0 18px #9c27b088)'}:
              {filter:'brightness(1) drop-shadow(0 0 0px transparent)'}
            }
            transition={{duration:0.4}} />
        </div>

        {/* My cards + coins */}
        <div className={styles.myArea}>
          <div className={styles.coinSide}>
            <img src={moedaImg} className={styles.coinIcon} alt="moeda" />
            <span className={styles.coinNum}>{myCoins}</span>
            {myCoins>=10&&(
              <motion.span className={styles.mustCoup}
                animate={{opacity:[1,0.4,1]}} transition={{repeat:Infinity,duration:0.8}}>
                GOLPE!
              </motion.span>
            )}
          </div>
          <div className={styles.myCards}>
            {me?.cards.map((c,i)=><Card key={i} character={c.character} dead={c.dead} size="xl"/>)}
          </div>
        </div>
      </div>

      {/* ── RIGHT: actions (top) + char cards (bottom) ── */}
      <div className={styles.rightPanel}>

        {/* ── ACTIONS TOP ── */}
        <div className={styles.actionsTop}>

          {/* ── Coin flip ── */}
          {phase==='COIN_FLIP'&&(
            <motion.div className={styles.coinFlipBox}
              initial={{opacity:0,y:8}} animate={{opacity:1,y:0}}>

              {/* Estado 1: aguardando bloqueador jogar */}
              {!pa?.coinFlipResult&&(
                <>
                  <p className={styles.coinFlipTitle}>🪙 Hora do Cara ou Coroa!</p>
                  {iAmBlocker?(
                    <>
                      <p className={styles.coinFlipDesc}>É a sua vez! Jogue a moeda para defender o bloqueio.</p>
                      <motion.button className={styles.flipBtn}
                        whileHover={{scale:1.04}} whileTap={{scale:0.94}}
                        onClick={()=>emit('flip_coin',{})}>
                        🪙 Jogar a Moeda
                      </motion.button>
                    </>
                  ):(
                    <p className={styles.coinFlipDesc}>
                      ⌛ <strong>{blockerName}</strong> está se preparando para jogar a moeda...
                    </p>
                  )}
                </>
              )}

              {/* Estado 2: moeda girando (animação 3s) */}
              {pa?.coinFlipResult&&coinAnimating&&(
                <>
                  <p className={styles.coinFlipTitle}>🪙 A moeda está girando...</p>
                  <motion.span className={styles.coinSpin}
                    animate={{rotateY:360}}
                    transition={{repeat:Infinity,duration:0.35,ease:'linear'}}>
                    🪙
                  </motion.span>
                </>
              )}

              {/* Estado 3: resultado (exibido brevemente antes do auto-acknowledge) */}
              {pa?.coinFlipResult&&!coinAnimating&&(
                <>
                  <p className={styles.coinFlipTitle}>🪙 Resultado da Moeda!</p>
                  <div className={styles.coinFlipResultText}
                    style={{color: pa.coinFlipResult==='cara' ? '#4caf50' : '#f44336'}}>
                    {pa.coinFlipResult==='cara' ? '🦅 CARA' : '🐉 COROA'}
                  </div>
                  <p className={styles.coinFlipDesc}>
                    {pa.coinFlipResult==='cara'
                      ? `Bloqueio aprovado! ${blockerName} recupera a moeda.`
                      : `Bloqueio cancelado! Bicheiro fica com a moeda e ainda rouba de ${targetName}!`
                    }
                  </p>
                </>
              )}
            </motion.div>
          )}

          {/* ── CHALLENGE_WON: actor decides swap or keep ── */}
          {phase==='CHALLENGE_WON'&&(
            <motion.div className={styles.challengeWonBox}
              initial={{opacity:0,y:8}} animate={{opacity:1,y:0}}>
              <p className={styles.challengeWonTitle}>
                ✅ Duvidada falhou! {pa?.challengeWonCharacter&&(
                  <span>{CHAR_CONFIG[pa.challengeWonCharacter]?.icon} {CHAR_CONFIG[pa.challengeWonCharacter]?.label}</span>
                )} foi comprovada!
              </p>
              {mustChooseChallengeWon?(
                <>
                  <p className={styles.challengeWonDesc}>Deseja trocar essa carta pelo baralho ou mantê-la?</p>
                  <Btn icon="🔄" label="Trocar pelo Baralho" sub="pegar uma carta nova"
                    onClick={()=>emit('challenge_won_choice',{wantsSwap:true})} />
                  <Btn icon="✊" label="Manter a Carta" sub="continuar com essa"
                    onClick={()=>emit('challenge_won_choice',{wantsSwap:false})} />
                </>
              ):(
                <p className={styles.hint}>
                  ⌛ {actorName} está decidindo se troca a carta...
                </p>
              )}
            </motion.div>
          )}

          {/* X9 peek */}
          {mustAcknowledgePeek&&pa?.x9Result&&(
            <motion.div className={styles.x9Result} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}}>
              <p className={styles.x9ResultTitle}>🕵️ Carta de <strong>{targetName}</strong>:</p>
              <div className={styles.x9ResultCard}>
                <span>{CHAR_CONFIG[pa.x9Result.character]?.icon}</span>
                <strong>{CHAR_CONFIG[pa.x9Result.character]?.label}</strong>
              </div>
              <motion.button className={styles.x9AckBtn} whileTap={{scale:0.96}}
                onClick={()=>emit('acknowledge_peek',{})}>
                Ok, guardei no coração 🤫
              </motion.button>
            </motion.div>
          )}

          {/* ── Confirmation overlay ── */}
          <AnimatePresence>
            {canAct&&pendingConfirm&&(
              <motion.div className={styles.confirmBox}
                initial={{opacity:0,scale:0.97}} animate={{opacity:1,scale:1}}
                exit={{opacity:0,scale:0.97}}>
                <p className={styles.confirmTitle}>Confirmar ação?</p>
                <p className={styles.confirmAction}>{ACTION_NAMES[pendingConfirm.action]}</p>
                {pendingConfirm.targetId&&(
                  <p className={styles.confirmTarget}>
                    Alvo: <strong>{players.find(p=>p.id===pendingConfirm.targetId)?.name}</strong>
                  </p>
                )}
                {/* Seleção de carta para Veredito */}
                {pendingConfirm.action==='veredito'&&(
                  <div style={{marginTop:8}}>
                    <p className={styles.confirmTitle} style={{fontSize:12,color:'var(--muted)'}}>
                      Acusar o alvo de ter qual carta?
                    </p>
                    <div style={{display:'flex',flexWrap:'wrap',gap:4,justifyContent:'center',marginTop:4}}>
                      {Object.entries(CHAR_CONFIG).map(([charKey,cfg])=>(
                        <motion.button key={charKey}
                          className={styles.actionBtn}
                          style={{
                            '--char-color':cfg.color,
                            border: pendingConfirm.vereditoChar===charKey
                              ? `2px solid ${cfg.color}` : '2px solid transparent',
                            padding:'4px 8px', minWidth:0, flex:'0 0 auto',
                          }}
                          whileTap={{scale:0.96}}
                          onClick={()=>setPendingConfirm(prev=>({...prev,vereditoChar:charKey}))}>
                          <span>{cfg.icon}</span>
                          <div><strong style={{fontSize:11}}>{cfg.label}</strong></div>
                        </motion.button>
                      ))}
                    </div>
                    {pendingConfirm.vereditoChar&&(
                      <p style={{fontSize:12,color:'#ffd600',marginTop:4,textAlign:'center'}}>
                        Acusando de ter: {CHAR_CONFIG[pendingConfirm.vereditoChar]?.icon} {CHAR_CONFIG[pendingConfirm.vereditoChar]?.label}
                      </p>
                    )}
                  </div>
                )}
                <div className={styles.confirmBtns}>
                  <motion.button className={styles.confirmYes}
                    whileTap={{scale:0.96}} onClick={confirmAction}>
                    ✓ Confirmar
                  </motion.button>
                  <motion.button className={styles.confirmNo}
                    whileTap={{scale:0.96}} onClick={cancelConfirm}>
                    ✕ Cancelar
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Action categories (visíveis sempre na fase ACTION_SELECT) ── */}
          {phase==='ACTION_SELECT'&&!pendingConfirm&&(
            <>
              {isMyTurn&&selectedTarget&&(
                <div className={styles.targetPill}>
                  🎯 <strong>{players.find(p=>p.id===selectedTarget)?.name}</strong>
                  <button className={styles.clearTarget} onClick={()=>setSelectedTarget(null)}>✕</button>
                </div>
              )}

              {ACTION_CATEGORIES.map((cat,ci)=>{
                const mustGolpe = myCoins>=10;
                const isMyCat = cat.charKey && me?.cards?.some(c=>!c.dead&&c.character===cat.charKey);
                return (
                  <div key={cat.id} className={styles.catSection} style={{'--cat-bg':isMyTurn?cat.bg:'transparent'}}>
                    {ci>0&&<div className={styles.catDivider}/>}
                    <div style={{display:'flex',alignItems:'center',gap:5}}>
                      <span className={styles.catLabel} style={{color:cat.labelColor}}>{cat.label}</span>
                      {isMyCat&&<span style={{fontSize:'0.55rem',color:cat.labelColor,fontWeight:800,border:`1px solid ${cat.labelColor}`,borderRadius:4,padding:'1px 4px'}}>SUA CARTA</span>}
                    </div>
                    {cat.actions.map(({action,icon,label,sub,tooltip})=>{
                      const isDisabled =
                        !isMyTurn ||
                        (action!=='golpe'&&mustGolpe) ||
                        (action==='golpe'&&myCoins<7) ||
                        (action==='assassinar'&&myCoins<3) ||
                        (action==='veredito'&&myCoins<5);
                      return (
                        <Btn key={action}
                          icon={icon} label={label} sub={sub} tooltip={tooltip}
                          disabled={isDisabled}
                          onClick={isMyTurn?()=>stageAction(action, ACTION_TO_CHAR[action]??null):undefined}
                        />
                      );
                    })}
                  </div>
                );
              })}

              {isMyTurn&&!selectedTarget&&(
                <p className={styles.hint}>⬆ Clique num oponente para selecionar alvo</p>
              )}
              {!isMyTurn&&me?.alive&&(
                <p className={styles.hint}>⌛ Aguardando {players.find(p=>p.id===currentPlayerId)?.name} jogar...</p>
              )}
            </>
          )}

          {/* ── Waiting (fases não-ACTION_SELECT) ── */}
          {phase!=='ACTION_SELECT'&&!canChallengeAct&&!canBlockAct&&!canChallengeBlock&&!mustAcknowledgePeek&&phase!=='COIN_FLIP'&&me?.alive&&(
            <p className={styles.hint}>
              {phase==='RESPONSE_WINDOW'&&!iAmActor&&alreadyResponded
                ?'✅ Aguardando outros jogadores...'
                :phase==='RESPONSE_WINDOW'&&!iAmActor&&!iAmTarget&&isTargetedAction&&!isAnyoneChallenge
                ?'👀 Só o alvo pode responder esta ação'
                :'⌛ Aguardando...'}
            </p>
          )}

          {/* ── Response window ── */}
          {(canChallengeAct||canBlockAct||canPassForVeredito)&&(
            <motion.div className={styles.responseBox}
              initial={{opacity:0,y:6}} animate={{opacity:1,y:0}}>
              <p className={styles.responseTitle}>
                <strong>{actorName}</strong> declara <strong>{ACTION_NAMES[pa?.type]}</strong>
                {targetName&&<> em <strong>{targetName}</strong></>}
              </p>
              {/* Mostra a carta acusada no Veredito */}
              {pa?.type==='veredito'&&pa?.vereditoCharacter&&(
                <div style={{
                  background:'rgba(255,214,0,0.1)', border:'1px solid #ffd600',
                  borderRadius:8, padding:'6px 10px', marginBottom:4, fontSize:13,
                }}>
                  ⚖️ Acusado de ter:{' '}
                  <strong>{CHAR_CONFIG[pa.vereditoCharacter]?.icon} {CHAR_CONFIG[pa.vereditoCharacter]?.label}</strong>
                  {iAmTarget&&(
                    <span style={{color:'#ef9a9a',display:'block',marginTop:2}}>
                      Você {me?.cards?.some(c=>!c.dead&&c.character===pa.vereditoCharacter)
                        ?'TEM essa carta 😬':'NÃO TEM essa carta 😌'}
                    </span>
                  )}
                </div>
              )}
              {/* Aviso sobre custo do bloqueio para Bicheiro */}
              {canBlockAct&&pa?.type==='roubar'&&(
                <div style={{fontSize:12,color:'#ffb74d',marginBottom:4}}>
                  🪙 Bloquear custa 1 moeda! O Bicheiro joga cara ou coroa.
                  Cara = bloqueio ok + moeda de volta. Coroa = bloqueio cai + Bicheiro rouba.
                </div>
              )}
              {canChallengeAct&&(
                <Btn icon="⚔️" label="DUVIDAR" sub="chamar o VAR!" danger
                  tooltip="Desafie a afirmação. Se errar, você perde uma carta."
                  onClick={()=>{sfx.challenge();emit('challenge',{});}} />
              )}
              {canBlockAct&&blockOptions.map(char=>(
                <Btn key={char}
                  icon={CHAR_CONFIG[char]?.icon}
                  label={`Bloquear como ${CHAR_CONFIG[char]?.label}`}
                  sub={pa?.type==='roubar' ? 'custa 1 moeda + cara ou coroa' : 'clique para selecionar'}
                  tooltip={`Afirma ser o ${CHAR_CONFIG[char]?.label} para bloquear esta ação.`}
                  selected={blockChar===char}
                  onClick={()=>setBlockChar(p=>p===char?null:char)} />
              ))}
              {blockChar&&(
                <Btn icon="🛡️" label="Confirmar Bloqueio"
                  sub={`como ${CHAR_CONFIG[blockChar]?.label}${pa?.type==='roubar'?' · 1 moeda':''}`} success
                  onClick={()=>{sfx.block();emit('block',{character:blockChar},()=>setBlockChar(null));}} />
              )}
              <Btn icon="✅" label="Ignorar" sub="deixar acontecer"
                onClick={()=>emit('pass',{})} />
            </motion.div>
          )}

          {/* ── Block challenge ── */}
          {canChallengeBlock&&(
            <motion.div className={styles.responseBox}
              initial={{opacity:0,y:6}} animate={{opacity:1,y:0}}>
              <p className={styles.responseTitle}>
                <strong>{blockerName}</strong> bloqueou como{' '}
                <strong>{CHAR_CONFIG[pa?.blocker?.character]?.label}</strong>
              </p>
              <Btn icon="⚔️" label="Duvidar do Bloqueio" sub="chama o VAR!" danger
                tooltip="Desafie o bloqueio. Se o bloqueador estiver blefando, a ação continua."
                onClick={()=>{sfx.challenge();emit('challenge',{});}} />
              <Btn icon="✅" label="Aceitar Bloqueio" sub="desistir da jogada"
                onClick={()=>emit('pass',{})} />
            </motion.div>
          )}

          <AnimatePresence>
            {error&&(
              <motion.div className={styles.errorMsg}
                initial={{opacity:0,x:-4}} animate={{opacity:1,x:0}} exit={{opacity:0}}>
                {error}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── FINGIR PERSONAGEM (bottom) ── */}
        <div className={styles.charSection}>
          <p className={styles.panelLabel}>Fingir um personagem</p>
          <div className={styles.charGrid}>
            {Object.entries(CHAR_CONFIG).map(([charKey,cfg])=>{
              const isMine   = me?.cards.some(c=>!c.dead&&c.character===charKey);
              const isDimmed = canAct&&activeChar!==null&&charKey!==activeChar;
              const isActive = canAct&&charKey===activeChar;
              return (
                <motion.div key={charKey}
                  className={`${styles.charCard}
                    ${isMine?styles.charCardMine:''}
                    ${isActive?styles.charCardSelected:''}
                    ${isDimmed?styles.charCardDimmed:''}
                  `}
                  style={{'--char-color':cfg.color}}
                  animate={isDimmed?{filter:'grayscale(0.8)',opacity:0.3}:{filter:'grayscale(0)',opacity:1}}
                  transition={{duration:0.25}}>
                  {cfg.img
                    ?<img src={cfg.img} alt={cfg.label} className={styles.charCardImg}/>
                    :<div className={styles.charCardFallback}><span>{cfg.icon}</span></div>
                  }
                  {isMine&&<div className={styles.mineBadge}>✓</div>}
                  {isActive&&<div className={styles.selectedBadge}>✓ USANDO</div>}
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Reiniciar (apenas host) */}
      {isHost&&(
        <motion.button className={styles.restartBtn}
          whileHover={{scale:1.05}} whileTap={{scale:0.95}}
          onClick={()=>{
            if(window.confirm('Reiniciar a partida agora? O jogo atual será apagado.'))
              socket.emit('restart_game',{});
          }}>
          🔄 Reiniciar
        </motion.button>
      )}

      {/* Help */}
      <motion.button className={styles.helpBtn}
        whileHover={{scale:1.05}} whileTap={{scale:0.95}}
        onClick={()=>setShowHelp(h=>!h)}>
        ? Regras
      </motion.button>

      <AnimatePresence>
        {showHelp&&(
          <motion.div className={styles.helpOverlay}
            initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            onClick={()=>setShowHelp(false)}>
            <motion.div className={styles.helpModal}
              initial={{scale:0.85,y:30}} animate={{scale:1,y:0}}
              exit={{scale:0.85,opacity:0}}
              onClick={e=>e.stopPropagation()}>
              <h2>Personagens</h2>
              {Object.entries(CHAR_CONFIG).map(([key,cfg])=>(
                <div key={key} className={styles.helpRow}>
                  <span>{cfg.icon}</span><strong>{cfg.label}</strong><span>{cfg.desc}</span>
                </div>
              ))}
              <motion.button className="btn btn-primary" style={{marginTop:16,width:'100%'}}
                whileTap={{scale:0.97}} onClick={()=>setShowHelp(false)}>
                Fechar
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </>
  );
}

// ── Btn component with tooltip ─────────────────────────────────────────────────
function Btn({ icon, label, sub, onClick, disabled, danger, success, selected, tooltip }) {
  return (
    <motion.button
      className={`${styles.actionBtn}
        ${danger?styles.actionBtnDanger:''}
        ${success?styles.actionBtnSuccess:''}
        ${selected?styles.actionBtnSelected:''}
      `}
      disabled={disabled}
      onClick={onClick}
      data-tooltip={tooltip||undefined}
      whileHover={!disabled?{scale:1.02,y:-1}:{}}
      whileTap={!disabled?{scale:0.96}:{}}
      transition={{type:'spring',stiffness:400,damping:20}}>
      <span className={styles.actionIcon}>{icon}</span>
      <div><strong>{label}</strong><small>{sub}</small></div>
    </motion.button>
  );
}
