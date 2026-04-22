import { useEffect, useRef } from 'react';
import { sfx } from './sfx';

/**
 * Hook que escuta mudanças no estado do jogo e dispara os sons corretos.
 * @param {object} game  - estado sanitizado do jogo
 * @param {string} myId  - socket id do jogador local
 */
export function useSoundEffects(game, myId) {
  const prevPhase   = useRef(null);
  const prevTurn    = useRef(null);
  const prevCoins   = useRef(null);
  const prevWinner  = useRef(null);

  useEffect(() => {
    if (!game) return;

    const { phase, currentPlayerId, pendingAction: pa, winner } = game;
    const me = game.players?.find(p => p.id === myId);

    // ── Vitória / derrota ─────────────────────────────────────────────────────
    if (winner && winner !== prevWinner.current) {
      winner === myId ? sfx.win() : sfx.lose();
    }

    // ── Mudança de fase ───────────────────────────────────────────────────────
    if (phase !== prevPhase.current) {
      if (phase === 'RESPONSE_WINDOW') {
        // Som único por tipo de ação
        switch (pa?.type) {
          case 'assassinar':   sfx.gunshot(); break;
          case 'taxar':        sfx.cashRegister(); break;
          case 'roubar':       sfx.steal(); break;
          case 'veredito':     sfx.gavel(); break;
          case 'golpe':        sfx.boom(); break;
          case 'meter_x9':     sfx.spy(); break;
          case 'disfarce':     sfx.cardFlip(); break;
          case 'trocar_carta': sfx.cardFlip(); break;
          default:             sfx.action(); break;
        }
      }
      if (phase === 'BLOCK_CHALLENGE_WINDOW') sfx.block();
      if (phase === 'LOSE_INFLUENCE')         sfx.eliminate();
      if (phase === 'X9_PEEK_SELECT')         sfx.spy();
      if (phase === 'X9_PEEK_VIEW')           sfx.x9();
      if (phase === 'CARD_SWAP_SELECT')       sfx.cardFlip();
    }

    // ── Minha vez ─────────────────────────────────────────────────────────────
    if (
      phase === 'ACTION_SELECT' &&
      currentPlayerId === myId &&
      prevTurn.current !== myId
    ) {
      sfx.myTurn();
    }

    // ── Ganhei moedas ─────────────────────────────────────────────────────────
    if (
      me &&
      prevCoins.current !== null &&
      me.coins > prevCoins.current
    ) {
      sfx.coin();
    }

    // Salva estado anterior
    prevPhase.current  = phase;
    prevTurn.current   = currentPlayerId;
    prevCoins.current  = me?.coins ?? null;
    prevWinner.current = winner;

  }, [game, myId]);
}
