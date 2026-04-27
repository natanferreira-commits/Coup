import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import socket from '../socket';
import Card from '../components/Card';
import { CHAR_CONFIG } from '../components/charConfig';
import GameLog from '../components/GameLog';
import TurnCard from '../components/TurnCard';
import CardSelectorModal from '../components/CardSelectorModal';
import { useSoundEffects } from '../sounds/useSoundEffects';
import { sfx } from '../sounds/sfx';
import CoinAnimation      from '../components/CoinAnimation';
import CardDeathAnimation  from '../components/CardDeathAnimation';
import BlockAnimation      from '../components/BlockAnimation';
import ChallengeAnimation  from '../components/ChallengeAnimation';
import TurnIndicator       from '../components/TurnIndicator';
import VictoryOverlay      from '../components/VictoryOverlay';
import QuickChatBubble     from '../components/QuickChatBubble';
import ActionCinematic     from '../components/ActionCinematic';
import CoinFlipModal       from '../components/CoinFlipModal';
import DisfarceModal       from '../components/DisfarceModal';
import ChallengeWonModal   from '../components/ChallengeWonModal';
import SettingsPanel       from '../components/SettingsPanel';
import EventPopup             from '../components/EventPopup';
import RoundEventAnnounce    from '../components/RoundEventAnnounce';
import ChatBubblesLayer      from '../components/ChatBubblesLayer';
import HowToPlayModal        from '../components/HowToPlayModal';
import JukeboxModal          from '../components/JukeboxModal';
import moedaImg from '../assets/moeda.svg';
import mesaImg  from '../assets/mesa.svg';
import styles from './Game.module.css';

// Imagem da jukebox — carregada dinamicamente (build não quebra se não existir)
const _jukeboxAssets = import.meta.glob('../assets/jukebox.*', { eager: true, import: 'default' });
const jukeboxImg = Object.values(_jukeboxAssets)[0] ?? null;

// ── Constants ─────────────────────────────────────────────────────────────────

const ACTION_NAMES = {
  renda:'Trampo Suado', ajuda_externa:'Imposto é Roubo', golpe:'Golpe de Estado',
  taxar:'Faz o L', roubar:'Pegar o Arrego', assassinar:'Mandar pro Vasco',
  veredito:'Veredito',
  meter_x9:'Meter o X9', disfarce:'Disfarce', trocar_carta:'Infiltrar',
};

const ACTION_ICONS = {
  renda:'💵', ajuda_externa:'💸', golpe:'💥',
  taxar:'🏛️', roubar:'💼', assassinar:'🔫',
  veredito:'⚖️', meter_x9:'🕵️', disfarce:'🎭', trocar_carta:'🔄',
};

const TARGET_ACTIONS = ['golpe','roubar','assassinar','veredito','meter_x9','trocar_carta'];

const BLOCK_OPTIONS = {
  ajuda_externa:['politico'], roubar:['juiz','guarda_costas'],
  assassinar:['guarda_costas'], meter_x9:['juiz'], trocar_carta:['juiz'],
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
      { action:'disfarce',     icon:'🎭', label:'Disfarce',          sub:'Troca sua carta', tooltip:'Afirma ser o X9. Troca uma de suas cartas pelo baralho em segredo. Não pode ser bloqueada.' },
      { action:'trocar_carta', icon:'🕵️', label:'Infiltrar',          sub:'Força troca',   tooltip:'Afirma ser o X9. Infiltra o alvo e força uma troca de carta. Juiz pode bloquear.' },
    ],
  },
];

// ── Avatar color helper ────────────────────────────────────────────────────────
const AVATAR_COLORS = [
  'linear-gradient(135deg,#2979ff,#1a237e)',
  'linear-gradient(135deg,#e53935,#7f0000)',
  'linear-gradient(135deg,#00897b,#004d40)',
  'linear-gradient(135deg,#8e24aa,#4a148c)',
  'linear-gradient(135deg,#f57c00,#bf360c)',
  'linear-gradient(135deg,#039be5,#01579b)',
];
function getAvatarColor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

const QUICK_MSGS = ['MENTIROSO 🤡', 'CONFIA 😂', 'me rouba não 😭', 'X9 safado 👀', 'FAZ O L 🇧🇷'];

export default function Game({ data, myId, musicTrack, musicLastChanged }) {
  const [selectedTarget,   setSelectedTarget]   = useState(null);
  const [pendingConfirm,   setPendingConfirm]   = useState(null);
  const [blockChar,        setBlockChar]        = useState(null);
  const [vereditoChar,     setVereditoChar]     = useState(null);
  const [error,            setError]            = useState('');
  const [showHelp,         setShowHelp]         = useState(false);
  const [showJukebox,      setShowJukebox]      = useState(false);
  const [timeLeft,         setTimeLeft]         = useState(30);
  const [coinAnimating,    setCoinAnimating]    = useState(false); // 3s animation after flip
  const [actionNotif,      setActionNotif]      = useState(null);
  const [muted,            setMuted]            = useState(() => {
    try { return localStorage.getItem('golpe_muted') === 'true'; } catch { return false; }
  });
  const [chatBubbles,      setChatBubbles]      = useState({}); // { [playerId]: { message, key } }
  const [screenShake,      setScreenShake]      = useState(false);
  const [showSettings,     setShowSettings]     = useState(false);
  const [activeEventPopup, setActiveEventPopup] = useState(null); // evento visível no popup
  const [eventAnnouncing,  setEventAnnouncing]  = useState(false); // overlay "EVENTO CHEGANDO"
  const [mobileLeftOpen,   setMobileLeftOpen]   = useState(false); // drawer esquerdo em mobile

  // ── Animation state ───────────────────────────────────────────────────────
  const [coinAnims,      setCoinAnims]      = useState([]); // [{ id, from, to, amount }]
  const [cardDeathAnims, setCardDeathAnims] = useState([]); // [{ id, x, y }]
  const [blockAnim,      setBlockAnim]      = useState(false);
  const [challengeAnim,  setChallengeAnim]  = useState(false);
  const [turnVisible,    setTurnVisible]    = useState(false);

  // ── Refs ──────────────────────────────────────────────────────────────────
  /** playerId → DOM element for position queries */
  const playerElRefs = useRef(new Map());
  /** previous game snapshot for diff detection */
  const prevGameRef  = useRef(null);

  const game = data?.game;
  const { players, currentPlayerId, phase, pendingAction: pa, log, winner } = game || {};

  // ── Sound effects ──────────────────────────────────────────────────────────
  useSoundEffects(game, myId);

  // ── Turn timer countdown ──────────────────────────────────────────────────
  // Captura timerStartedAt diretamente no closure — reinicia tanto na mudança
  // de fase quanto na mudança de jogador (ACTION_SELECT → ACTION_SELECT)
  const timerStartRef = useRef(null); // ainda usado para a condição de exibição do timer
  useEffect(() => {
    timerStartRef.current = data?.timerStartedAt ?? null;
  }); // runs every render — keeps ref always fresh

  useEffect(() => {
    if (phase === 'GAME_OVER') { setTimeLeft(60); return; }
    // Usa timeRemaining calculado pelo servidor para evitar dessincronização
    // por diferença de relógio entre cliente e servidor (clock skew).
    const remaining = data?.timeRemaining;
    if (remaining == null) { setTimeLeft(60); return; }
    setTimeLeft(remaining);
    const startLocal = Date.now();
    const id = setInterval(() => {
      setTimeLeft(Math.max(0, Math.round(remaining - (Date.now() - startLocal) / 1000)));
    }, 300);
    return () => clearInterval(id);
  }, [phase, data?.timerStartedAt]); // timerStartedAt como dep → reinicia a cada novo turno

  // ── Detecção de round: exibe "EVENTO CHEGANDO" 2s, depois EventPopup ────────
  // Ref com sentinela -1 = ainda não inicializado (primeiro render)
  const prevRoundRef = useRef(-1);
  useEffect(() => {
    const roundNum = game?.roundNumber;
    if (!roundNum) return;

    const prev = prevRoundRef.current;
    prevRoundRef.current = roundNum;

    const ev = game?.activeEvent;

    if (prev === -1) {
      // Carga inicial / reconexão: mostra popup diretamente se tiver evento ativo
      if (ev && ev.type !== 'no_event') {
        setActiveEventPopup(ev);
      }
      return;
    }

    if (prev === roundNum) return; // mesmo round, nada a fazer

    // ── Novo round detectado ──────────────────────────────────────────────
    if (ev && ev.type !== 'no_event') {
      // Tem evento real: anuncia por 2s, depois abre popup
      sfx.challenge();
      setActiveEventPopup(null);
      setEventAnnouncing(true);
      const t = setTimeout(() => {
        setEventAnnouncing(false);
        setActiveEventPopup(ev);
      }, 2000);
      return () => clearTimeout(t);
    }
    // Sem evento (no_event): a piada já foi pro chat pelo servidor, sem popup
  }, [game?.roundNumber]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // ── Action cinematic (replaces small popup — synchronized via game state) ──
  useEffect(() => {
    if (!pa?.type || !pa?.actorId) return;
    const key = `${pa.actorId}:${pa.type}`;
    if (key === prevActionKeyRef.current) return;
    prevActionKeyRef.current = key;
    const actorP  = players?.find(p => p.id === pa.actorId);
    const targetP = pa.targetId ? players?.find(p => p.id === pa.targetId) : null;
    // Feed both the new ActionCinematic and legacy actionNotif (as fallback data)
    const notif = {
      type: pa.type,
      icon: ACTION_ICONS[pa.type] || '⚡',
      label: ACTION_NAMES[pa.type],
      actorName: actorP?.name,
      targetName: targetP?.name,
      claimedCharacter: pa.claimedCharacter,
    };
    setActionNotif(notif);  // kept for legacy (no longer rendered as small popup)
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
    // NÃO limpar actionNotif aqui — o ActionCinematic gerencia seu próprio ciclo de vida
    // (auto-dismiss 3s). Limpar aqui matava o cinematic antes de mostrar.
  }, [phase]);

  // ── Auto-lose quando só resta 1 carta (não precisa de escolha) ──────────
  const autoLoseFiredRef = useRef(false);
  useEffect(() => {
    if (!game) return;
    const { phase: ph, pendingAction: pa2 } = game;
    if (ph !== 'LOSE_INFLUENCE') { autoLoseFiredRef.current = false; return; }
    if (!pa2?.loseInfluenceQueue?.length) return;
    if (pa2.loseInfluenceQueue[0].playerId !== myId) return;
    const myPlayer = game.players.find(p => p.id === myId);
    const aliveCards = myPlayer?.cards?.filter(c => !c.dead) || [];
    if (aliveCards.length === 1 && !autoLoseFiredRef.current) {
      autoLoseFiredRef.current = true;
      const cardIdx = myPlayer.cards.findIndex(c => !c.dead);
      socket.emit('lose_influence', { cardIndex: cardIdx });
    }
  }, [game, myId]);

  // ── Sync sfx mute on mount ────────────────────────────────────────────────
  useEffect(() => {
    if (muted !== sfx.isMuted()) sfx.toggleMute();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Music is server-controlled via App.jsx music_changed listener — no local auto-start

  // ── Stable dismiss callbacks (useCallback evita resets de timer por nova referência) ──
  const dismissCinematic   = useCallback(() => setActionNotif(null), []);
  const dismissEventPopup  = useCallback(() => setActiveEventPopup(null), []);

  // ── Helpers for animation positions ──────────────────────────────────────
  const getPlayerPos = useCallback(playerId => {
    const el = playerElRefs.current.get(playerId);
    if (!el) return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, []);

  /** Posição do topo-centro do elemento para o chat bubble */
  const getBubblePos = useCallback(playerId => {
    const el = playerElRefs.current.get(playerId);
    if (!el) return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top };
  }, []);

  const getTablePos = useCallback(() => ({
    x: window.innerWidth / 2,
    y: window.innerHeight * 0.48,
  }), []);

  const pushCoinAnim = useCallback((from, to, amount) => {
    const id = Date.now() + Math.random();
    setCoinAnims(q => [...q, { id, from, to, amount }]);
    setTimeout(() => setCoinAnims(q => q.filter(a => a.id !== id)), 1100);
  }, []);

  const pushCardDeathAnim = useCallback((x, y) => {
    const id = Date.now() + Math.random();
    setCardDeathAnims(q => [...q, { id, x, y }]);
    setTimeout(() => setCardDeathAnims(q => q.filter(a => a.id !== id)), 1000);
  }, []);

  // ── Game state diff → trigger animations ─────────────────────────────────
  useEffect(() => {
    if (!game) return;
    const prev = prevGameRef.current;

    if (prev) {
      // ── COINS ──────────────────────────────────────────────────────────
      const gainers = [];
      const losers  = [];
      game.players.forEach(p => {
        const pp = prev.players.find(x => x.id === p.id);
        if (!pp) return;
        const diff = p.coins - pp.coins;
        if (diff > 0) gainers.push({ id: p.id, diff });
        if (diff < 0) losers.push({ id: p.id, diff: -diff });
      });

      if (gainers.length === 1 && losers.length === 1 && gainers[0].diff === losers[0].diff) {
        // Roubo direto: target → actor
        pushCoinAnim(getPlayerPos(losers[0].id), getPlayerPos(gainers[0].id), gainers[0].diff);
      } else {
        // Ganhos do banco
        gainers.forEach(g => pushCoinAnim(getTablePos(), getPlayerPos(g.id), g.diff));
        // Gastos para o banco (golpe, assassinar, veredito…)
        losers.forEach(l => pushCoinAnim(getPlayerPos(l.id), getTablePos(), l.diff));
      }

      // ── CARD DEATHS ────────────────────────────────────────────────────
      game.players.forEach(p => {
        const pp = prev.players.find(x => x.id === p.id);
        if (!pp) return;
        p.cards.forEach((c, i) => {
          if (!pp.cards[i]?.dead && c.dead) {
            const pos = getPlayerPos(p.id);
            pushCardDeathAnim(pos.x, pos.y);
          }
        });
      });

      // ── BLOCK ─────────────────────────────────────────────────────────
      if (game.phase === 'BLOCK_CHALLENGE_WINDOW' && prev.phase !== 'BLOCK_CHALLENGE_WINDOW') {
        setBlockAnim(true);
        setTimeout(() => setBlockAnim(false), 2800);
      }

      // ── CHALLENGE ─────────────────────────────────────────────────────
      if (
        (game.phase === 'CHALLENGE_WON' || game.phase === 'LOSE_INFLUENCE') &&
        (prev.phase === 'RESPONSE_WINDOW' || prev.phase === 'BLOCK_CHALLENGE_WINDOW')
      ) {
        setChallengeAnim(true);
        setTimeout(() => setChallengeAnim(false), 1000);
      }

      // ── TURN CHANGE ───────────────────────────────────────────────────
      if (game.currentPlayerId !== prev.currentPlayerId && game.phase === 'ACTION_SELECT') {
        setTurnVisible(true);
        setTimeout(() => setTurnVisible(false), 2600);
      }
    }

    prevGameRef.current = game;
  }, [game, getPlayerPos, getTablePos, pushCoinAnim, pushCardDeathAnim]);

  // ── Screen shake on challenge resolution ─────────────────────────────────
  const prevPhaseRef = useRef(null);
  useEffect(() => {
    if (
      (phase === 'CHALLENGE_WON' || phase === 'LOSE_INFLUENCE') &&
      (prevPhaseRef.current === 'RESPONSE_WINDOW' || prevPhaseRef.current === 'BLOCK_CHALLENGE_WINDOW')
    ) {
      setScreenShake(true);
      const t = setTimeout(() => setScreenShake(false), 700);
      return () => clearTimeout(t);
    }
    prevPhaseRef.current = phase;
  }, [phase]);

  // ── Quick chat socket listener ────────────────────────────────────────────
  useEffect(() => {
    const handler = ({ playerId, message }) => {
      sfx.chat();
      const key = Date.now() + Math.random();
      const mine = playerId === myId;
      setChatBubbles(prev => ({ ...prev, [playerId]: { message, key, mine } }));
      setTimeout(() => {
        setChatBubbles(prev => {
          const next = { ...prev };
          if (next[playerId]?.key === key) delete next[playerId];
          return next;
        });
      }, 4000);
    };
    socket.on('quick_chat', handler);
    return () => socket.off('quick_chat', handler);
  }, [myId]);

  // ── Mute toggle helper ────────────────────────────────────────────────────
  const toggleMute = () => {
    sfx.toggleMute();
    const m = sfx.isMuted();
    setMuted(m);
    try { localStorage.setItem('golpe_muted', String(m)); } catch {}
  };

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

  // Stage action for confirmation — target can be picked inside the confirm overlay
  const stageAction = (action, charKey) => {
    sfx.cardFlip();
    setError('');
    // Pre-fill targetId if one is already selected (convenience), otherwise null (picker shown)
    setPendingConfirm({ action, charKey: charKey ?? null, targetId: selectedTarget ?? null });
  };

  const confirmAction = () => {
    if (!pendingConfirm) return;
    if (TARGET_ACTIONS.includes(pendingConfirm.action) && !pendingConfirm.targetId)
      return setError('Selecione um alvo abaixo ⬇');
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
  const mustDisfarce        = phase === 'DISFARCE_SELECT'  && pa?.swapPlayerId === myId;
  const mustAckCoinFlip     = phase === 'COIN_FLIP'        && iAmActor;
  const mustChooseChallengeWon = phase === 'CHALLENGE_WON' && iAmActor;
  const isHost              = data?.hostId === myId;

  const blockOptions = pa ? (BLOCK_OPTIONS[pa.type] || []) : [];
  const actorName    = pa ? players.find(p => p.id === pa.actorId)?.name  : null;
  const targetName   = pa?.targetId ? players.find(p => p.id === pa.targetId)?.name : null;
  const blockerName  = pa?.blocker  ? players.find(p => p.id === pa.blocker.playerId)?.name : null;

  // Which character card to highlight in the fingir grid
  const activeChar = pendingConfirm?.charKey ?? null;

  // ── Ações bloqueadas pelo evento ativo (feedback visual imediato) ───────────
  const blockedActions = (() => {
    const evType = game?.activeEvent?.type;
    if (evType === 'operacao_pf') return ['roubar'];
    if (evType === 'fake_news')   return ['meter_x9', 'trocar_carta'];
    return [];
  })();

  // ── Game over ────────────────────────────────────────────────────────────────
  if (winner) {
    const w = players.find(p => p.id === winner);
    const losers = players.filter(p => p.id !== winner);
    return (
      <>
      <VictoryOverlay active />
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
      </>
    );
  }

  return (
    <>
    {/* ── Fullscreen action cinematic (synchronized for all players) ── */}
    <ActionCinematic
      cinematic={actionNotif}
      onDismiss={dismissCinematic}
    />

    {/* ── Coin flip modal (centered, 1 Real coin) ── */}
    <CoinFlipModal
      phase={phase}
      pa={pa}
      blockerName={blockerName}
      actorName={actorName}
      targetName={targetName}
      iAmBlocker={iAmBlocker}
      iAmActor={iAmActor}
      coinAnimating={coinAnimating}
      onFlip={() => emit('flip_coin', {})}
    />

    <ChallengeWonModal
      pa={pa}
      iAmActor={iAmActor}
      actorName={actorName}
      onSwap={() => emit('challenge_won_choice', { wantsSwap: true })}
      onKeep={() => emit('challenge_won_choice', { wantsSwap: false })}
    />

    <SettingsPanel
      open={showSettings}
      onClose={() => setShowSettings(false)}
      onLeave={() => {
        if (window.confirm('Sair da partida? Você será eliminado.'))
          socket.emit('leave_room', {}, () => { window.location.reload(); });
      }}
    />

    <RoundEventAnnounce
      active={eventAnnouncing}
      roundNumber={game?.roundNumber || 1}
    />

    <EventPopup
      event={activeEventPopup}
      onDismiss={dismissEventPopup}
    />

    <div className={`${styles.board}${screenShake?` ${styles.boardShake}`:''}`}>

      {/* ── Mobile header (só visível em mobile via CSS) ── */}
      <div className={styles.mobileHeader}>
        <div className={styles.mobileHeaderGroup}>
          <button className={styles.mobileIconBtn} onClick={() => setMobileLeftOpen(v => !v)}
            title="Chat / Log">💬</button>
        </div>
        <span className={styles.mobileLogo}>
          {data?.isPve && <span style={{ fontSize: '0.8rem', marginRight: 4 }}>🤖</span>}
          <span style={{ color: '#1351b4' }}>G</span>
          <span style={{ color: '#009c3b' }}>O</span>
          <span style={{ color: '#009c3b' }}>L</span>
          <span style={{ color: '#ffdf00' }}>P</span>
          <span style={{ color: '#1351b4' }}>E</span>
        </span>
        <div className={styles.mobileHeaderGroup}>
          <button className={styles.mobileIconBtn} onClick={() => setShowSettings(true)}
            title="Configurações">⚙️</button>
        </div>
      </div>

      {/* Backdrop quando drawer mobile está aberto */}
      {mobileLeftOpen && (
        <div className={styles.mobileBackdrop} onClick={() => setMobileLeftOpen(false)} />
      )}

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
          title={pa?.swapContext==='disfarce'?'Hora do Disfarce 🎭':'Infiltração 🕵️'}
          description={pa?.swapContext==='disfarce'
            ?'Escolha uma carta para trocar pelo baralho.'
            :`${actorName} forçou uma troca. Escolha qual carta trocar.`}
          cards={me?.cards||[]} confirmLabel="Trocar"
          onConfirm={i => emit('select_card_swap',{cardIndex:i})} />
      )}
      {mustDisfarce && (
        <DisfarceModal
          pa={pa}
          myCards={me?.cards || []}
          onConfirm={({ myCardIndex, pickedOption }) => emit('select_disfarce', { myCardIndex, pickedOption })}
          onSkip={() => emit('select_disfarce', { myCardIndex: 0, pickedOption: null })}
        />
      )}

      {/* ── LEFT ── */}
      <div className={`${styles.leftPanel}${mobileLeftOpen ? ` ${styles.leftPanelOpen}` : ''}`}>
        <TurnCard player={players.find(p=>p.id===currentPlayerId)} isMe={isMyTurn} />
        <p className={styles.panelLabel}>Chat da Rodada</p>
        <GameLog log={log} />
        {/* ── Quick chat panel ── */}
        <div className={styles.quickChatSection}>
          <p className={styles.panelLabel}>Zoeira 🎉</p>
          <div className={styles.quickChatGrid}>
            {QUICK_MSGS.map((msg, i) => (
              <motion.button key={i} className={styles.quickChatBtn}
                whileHover={{ scale: 1.04, y: -1 }}
                whileTap={{ scale: 0.94 }}
                onClick={() => {
                  sfx.click();
                  socket.emit('quick_chat', { msgIndex: i });
                }}>
                {msg}
              </motion.button>
            ))}
          </div>
        </div>

      </div>

      {/* ── CENTER ── */}
      <div className={styles.center}>

        {/* Opponents */}
        <div className={styles.opponents}>
          {others.map(p => {
            const isHost = p.id === data?.hostId;
            return (
              <div
                key={p.id}
                className={styles.opponentWrapper}
                ref={el => { if (el) playerElRefs.current.set(p.id, el); else playerElRefs.current.delete(p.id); }}
              >
                {/* Chat bubbles gerenciados pelo ChatBubblesLayer (portal fixo) */}

                <motion.div
                  className={`${styles.opponent}
                    ${p.id===currentPlayerId?styles.opponentActive:''}
                    ${!p.alive?styles.opponentDead:''}
                    ${selectedTarget===p.id?styles.opponentTargeted:''}
                  `}
                  whileHover={canAct&&p.alive?{scale:1.03,y:-2}:{}}
                  whileTap={canAct&&p.alive?{scale:0.97}:{}}
                  onClick={()=>canAct&&p.alive&&setSelectedTarget(prev=>prev===p.id?null:p.id)}
                  style={{cursor:canAct&&p.alive?'pointer':'default'}}>
                  <div className={styles.opponentAvatar}
                    style={{ background: getAvatarColor(p.name) }}>
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                  <div className={styles.opponentInfo}>
                    <div className={styles.opponentNameRow}>
                      <span className={styles.opponentName}>
                        {p.isBot && <span style={{marginRight:3}}>🤖</span>}{p.name}
                      </span>
                      {isHost && <span className={styles.hostBadge}>HOST</span>}
                    </div>
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
                  {p.id===currentPlayerId&&(
                    <motion.div className={styles.turnBadge}
                      animate={{ opacity:[1,0.5,1] }}
                      transition={{ repeat:Infinity, duration:0.9 }}>
                      🔥 VEZ
                    </motion.div>
                  )}
                  {selectedTarget===p.id&&<div className={styles.targetBadge}>🎯 ALVO</div>}
                </motion.div>
              </div>
            );
          })}
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
                  {pa?.swapContext==='disfarce'?'Disfarce':'Infiltrar'}
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
              <motion.span className={styles.mesaStatusIcon}
                animate={{scale:[1,1.12,1]}} transition={{repeat:Infinity,duration:1.1}}>🪙</motion.span>
              <span className={styles.mesaStatusMain}>Cara ou Coroa!</span>
              {/* Detailed UI está no CoinFlipModal centralizado */}
            </motion.div>
          )}

          {/* Timer — lateral, só número */}
          {phase&&phase!=='GAME_OVER'&&timerStartRef.current&&(
            <div className={styles.timerLateral}
              style={{color: timeLeft<=10?'var(--red)':timeLeft<=20?'#ffd600':timeLeft<=30?'rgba(255,255,255,0.5)':'rgba(255,255,255,0.22)'}}>
              {timeLeft}
            </div>
          )}

          <div className={styles.mesaRow}>
            {/* Jukebox — mesmo nível da mesa, à esquerda */}
            <motion.button
              className={styles.jukeboxBtn}
              onClick={() => setShowJukebox(v => !v)}
              whileHover={{ scale: 1.07, rotate: -2 }}
              whileTap={{ scale: 0.93 }}
              title="Música de fundo"
            >
              {jukeboxImg
                ? <img src={jukeboxImg} alt="Jukebox" className={styles.jukeboxImg} />
                : <span className={styles.jukeboxFallback}>🎰</span>
              }
            </motion.button>

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
        </div>

        {/* My cards + coins */}
        <div
          className={styles.myArea}
          ref={el => { if (el && myId) { if (el) playerElRefs.current.set(myId, el); else playerElRefs.current.delete(myId); } }}
        >
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
          <div className={styles.myAreaCards}>
            {/* My chat bubble também no ChatBubblesLayer */}
            <div className={styles.myMeta}>
              <span className={styles.youBadge}>VOCÊ</span>
              {isHost && <span className={styles.hostBadge}>HOST</span>}
              <span className={styles.myName}>{me?.name}</span>
            </div>
            <div className={styles.myCards}>
              {me?.cards.map((c,i)=><Card key={i} character={c.character} dead={c.dead} size="xl"/>)}
            </div>
          </div>
        </div>
      </div>

      {/* ── RIGHT: actions (top) + char cards (bottom) ── */}
      <div className={styles.rightPanel}>

        {/* ── ACTIONS TOP ── */}
        <div className={styles.actionsTop}>

          {/* Coin flip agora no CoinFlipModal centralizado */}
          {phase==='COIN_FLIP'&&(
            <p className={styles.hint}>🪙 Aguardando resultado da moeda...</p>
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

                {/* ── Target picker (shown when action needs target) ── */}
                {TARGET_ACTIONS.includes(pendingConfirm.action)&&(
                  <div style={{width:'100%',marginTop:6}}>
                    <p className={styles.confirmTitle} style={{fontSize:11,color:'var(--muted)',marginBottom:4}}>
                      🎯 Escolha o alvo:
                    </p>
                    <div style={{display:'flex',flexWrap:'wrap',gap:5,justifyContent:'center'}}>
                      {others.filter(p=>p.alive).map(p=>(
                        <motion.button key={p.id}
                          className={styles.actionBtn}
                          style={{
                            '--char-color': pendingConfirm.targetId===p.id ? '#ef9a9a' : 'rgba(255,255,255,0.15)',
                            border: pendingConfirm.targetId===p.id
                              ? '2px solid #ef9a9a' : '2px solid rgba(255,255,255,0.12)',
                            padding:'5px 10px', minWidth:0, flex:'0 0 auto',
                            background: pendingConfirm.targetId===p.id
                              ? 'rgba(239,154,154,0.12)' : 'rgba(255,255,255,0.04)',
                          }}
                          whileTap={{scale:0.96}}
                          onClick={()=>setPendingConfirm(prev=>({...prev,targetId:p.id}))}>
                          <strong style={{fontSize:12}}>{p.name}</strong>
                          <div style={{fontSize:10,opacity:0.6}}>{p.coins}🪙</div>
                        </motion.button>
                      ))}
                    </div>
                    {pendingConfirm.targetId&&(
                      <p style={{fontSize:11,color:'#ef9a9a',marginTop:4,textAlign:'center'}}>
                        Alvo: <strong>{players.find(p=>p.id===pendingConfirm.targetId)?.name}</strong>
                      </p>
                    )}
                  </div>
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
                      const isEventBlocked = blockedActions.includes(action);
                      const isDisabled =
                        !isMyTurn ||
                        (action!=='golpe'&&mustGolpe) ||
                        (action==='golpe'&&myCoins<7) ||
                        (action==='assassinar'&&myCoins<3) ||
                        (action==='veredito'&&myCoins<5) ||
                        isEventBlocked;
                      const eventBlockTooltip = isEventBlocked
                        ? (game?.activeEvent?.type === 'operacao_pf'
                            ? '🚔 Bloqueado pela Operação da PF neste round'
                            : '📰 Fake News: X9 e Infiltrar bloqueados neste round')
                        : null;
                      return (
                        <Btn key={action}
                          icon={icon} label={label}
                          sub={isEventBlocked ? (eventBlockTooltip) : sub}
                          tooltip={eventBlockTooltip || tooltip}
                          disabled={isDisabled}
                          onClick={isMyTurn&&!isEventBlocked?()=>stageAction(action, ACTION_TO_CHAR[action]??null):undefined}
                        />
                      );
                    })}
                  </div>
                );
              })}

              {!isMyTurn&&me?.alive&&(
                <p className={styles.hint}>⌛ Aguardando {players.find(p=>p.id===currentPlayerId)?.name} jogar...</p>
              )}
            </>
          )}

          {/* ── Waiting — tela informativa por fase ── */}
          {phase!=='ACTION_SELECT'&&!canChallengeAct&&!canBlockAct&&!canChallengeBlock&&!mustAcknowledgePeek&&phase!=='COIN_FLIP'&&me?.alive&&(
            <WaitingBox
              phase={phase} pa={pa}
              actorName={actorName} targetName={targetName} blockerName={blockerName}
              iAmActor={iAmActor} alreadyResponded={alreadyResponded}
              isTargetedAction={isTargetedAction} isAnyoneChallenge={isAnyoneChallenge}
              players={players}
            />
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

      {/* Settings */}
      <motion.button className={styles.muteBtn}
        whileHover={{scale:1.05}} whileTap={{scale:0.95}}
        onClick={() => { sfx.click(); setShowSettings(true); }}
        title="Configurações">
        ⚙️
      </motion.button>

      {/* Help */}
      <motion.button className={styles.helpBtn}
        whileHover={{scale:1.05}} whileTap={{scale:0.95}}
        onClick={()=>setShowHelp(h=>!h)}>
        ? Regras
      </motion.button>

      {showHelp    && <HowToPlayModal onClose={() => setShowHelp(false)} />}
      {showJukebox && <JukeboxModal onClose={() => setShowJukebox(false)} musicTrack={musicTrack} musicLastChanged={musicLastChanged} myCoins={me?.coins ?? 0} />}
    </div>

    {/* ── Overlays de animação ── */}
    <CoinAnimation      queue={coinAnims} />
    <CardDeathAnimation queue={cardDeathAnims} />
    <BlockAnimation     active={blockAnim} blockerCharacter={pa?.blocker?.character} />
    <ChallengeAnimation active={challengeAnim} />
    <TurnIndicator
      playerName={players?.find(p => p.id === currentPlayerId)?.name}
      isMe={isMyTurn}
      visible={turnVisible}
    />
    <ChatBubblesLayer bubbles={chatBubbles} getPos={getBubblePos} />
    </>
  );
}

// ── Btn component with tooltip ─────────────────────────────────────────────────
// ── WaitingBox — tela de espera contextual ───────────────────────────────────
function WaitingBox({ phase, pa, actorName, targetName, blockerName, iAmActor, alreadyResponded, isTargetedAction, isAnyoneChallenge, players }) {
  let icon = '⏳';
  let title = 'Aguardando...';
  let sub = null;

  if (phase === 'RESPONSE_WINDOW') {
    if (iAmActor) {
      icon = '👀';
      title = 'Aguardando reação dos outros jogadores';
      sub = 'Eles podem duvidar ou bloquear sua ação.';
    } else if (alreadyResponded) {
      icon = '✅';
      title = 'Você já passou';
      sub = 'Aguardando os outros responderem...';
    } else if (!iAmActor && isTargetedAction && !isAnyoneChallenge) {
      icon = '👀';
      title = `Ação direcionada a ${targetName}`;
      sub = 'Somente o alvo pode responder esta ação.';
    } else {
      icon = '🔔';
      title = `${actorName} declarou uma ação`;
      sub = 'Aguardando resolução...';
    }
  } else if (phase === 'BLOCK_CHALLENGE_WINDOW') {
    if (iAmActor) {
      icon = '🛡️';
      title = `${blockerName} bloqueou sua ação!`;
      sub = 'Você pode duvidar do bloqueio ou aceitar.';
    } else {
      icon = '🛡️';
      title = `${blockerName} bloqueou ${actorName}`;
      sub = `${actorName} decidindo se aceita ou duvida do bloqueio...`;
    }
  } else if (phase === 'LOSE_INFLUENCE') {
    const loserName = players?.find(p => p.id === pa?.loseInfluenceQueue?.[0]?.playerId)?.name;
    icon = '💀';
    title = `${loserName || 'Alguém'} está perdendo uma carta`;
    sub = 'Aguardando a escolha...';
  } else if (phase === 'CHALLENGE_WON') {
    icon = '✅';
    title = `${actorName} provou ter a carta!`;
    sub = 'Decidindo se troca pelo baralho ou mantém...';
  } else if (phase === 'X9_PEEK_SELECT') {
    icon = '🕵️';
    title = `${targetName} está escolhendo qual carta mostrar`;
    sub = `${actorName} aguarda para espionar...`;
  } else if (phase === 'X9_PEEK_VIEW') {
    icon = '🕵️';
    title = `${actorName} está vendo a carta de ${targetName}`;
    sub = 'Aguardando o X9 confirmar...';
  } else if (phase === 'CARD_SWAP_SELECT') {
    const swapName = players?.find(p => p.id === pa?.swapPlayerId)?.name;
    icon = '🔄';
    title = `${swapName || '...'} está escolhendo qual carta trocar`;
    sub = 'Aguardando a troca...';
  } else if (phase === 'DISFARCE_SELECT') {
    icon = '🎭';
    title = `${actorName} está analisando as opções de disfarce`;
    sub = 'Aguardando a escolha do X9...';
  } else if (phase === 'COIN_FLIP') {
    icon = '🪙';
    title = 'Cara ou Coroa em andamento!';
    sub = 'Veja o modal da moeda.';
  }

  return (
    <motion.div
      className={styles.waitingBox}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}>
      <motion.span
        className={styles.waitingIcon}
        animate={{ scale: [1, 1.15, 1] }}
        transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}>
        {icon}
      </motion.span>
      <div className={styles.waitingContent}>
        <span className={styles.waitingTitle}>{title}</span>
        {sub && <span className={styles.waitingSub}>{sub}</span>}
      </div>
    </motion.div>
  );
}

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
