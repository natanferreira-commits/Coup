import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './HowToPlayModal.module.css';

/* ── Personagens (baseado no código real do jogo) ────────────────────── */
const CHARS = [
  {
    name: 'Político',
    color: '#1565c0',
    emoji: '🏛️',
    ability: 'Faz o L',
    desc: 'Declara ser o Político e recebe 3 moedas do banco.',
    block: 'Bloqueia a Ajuda Externa ("Imposto é Roubo") de qualquer jogador.',
    blocked: null,
  },
  {
    name: 'Bicheiro',
    color: '#e65100',
    emoji: '💼',
    ability: 'Pegar o Arrego',
    desc: 'Rouba 2 moedas de outro jogador. Se o alvo tiver só 1, pega só 1.',
    block: null,
    blocked: 'Pode ser bloqueado pelo Juiz ou pelo Miliciano (coin flip).',
  },
  {
    name: 'X9',
    color: '#6a1b9a',
    emoji: '🕵️',
    ability: 'Meter o X9 / Disfarce / Infiltrar',
    desc: '3 ações: (1) Meter o X9 — espia as cartas de um alvo. (2) Disfarce — troca suas próprias cartas com o baralho (não pode ser bloqueada). (3) Infiltrar — força o alvo a trocar uma carta.',
    block: null,
    blocked: 'Meter o X9 e Infiltrar podem ser bloqueadas pelo Juiz. Disfarce não pode ser bloqueada.',
  },
  {
    name: 'Juiz',
    color: '#1b5e20',
    emoji: '⚖️',
    ability: 'Veredito',
    desc: 'Paga 5 moedas e acusa um jogador de ter um personagem específico. Se o alvo tiver aquela carta → perde a influência. Se não tiver → o Juiz errou e perde as moedas sem efeito.',
    block: 'Bloqueia o Bicheiro (roubo) e todas as ações do X9.',
    blocked: null,
  },
  {
    name: 'Bandido',
    color: '#b71c1c',
    emoji: '🔫',
    ability: 'Mandar pro Vasco',
    desc: 'Paga 3 moedas e elimina 1 influência de outro jogador diretamente.',
    block: null,
    blocked: 'Pode ser bloqueado pelo Miliciano.',
  },
  {
    name: 'Miliciano',
    color: '#4e342e',
    emoji: '🛡️',
    ability: 'Defesa',
    desc: 'Não possui ação de ataque. Especialista em bloqueio.',
    block: 'Bloqueia o Bandido (assassinato). Bloqueia o Bicheiro (roubo) — com custo de 1 moeda e coin flip: cara devolve a moeda, coroa perde.',
    blocked: null,
  },
];

/* ── Ações ───────────────────────────────────────────────────────────── */
const ACTIONS = [
  {
    name: 'Trampo Suado',
    cost: 0,
    desc: 'Pegue 1 moeda do banco. Não pode ser bloqueada nem desafiada.',
    tag: 'Sempre disponível',
    tagColor: 'green',
  },
  {
    name: 'Imposto é Roubo',
    cost: 0,
    desc: 'Pegue 2 moedas do banco. Pode ser bloqueada pelo Político.',
    tag: 'Sempre disponível',
    tagColor: 'green',
  },
  {
    name: 'Golpe de Estado',
    cost: 7,
    desc: 'Pague 7 moedas e elimine 1 influência de qualquer jogador. Não pode ser bloqueado nem desafiado. Com 10+ moedas, usar o Golpe é obrigatório.',
    tag: 'Sempre disponível',
    tagColor: 'green',
  },
  {
    name: 'Faz o L (Político)',
    cost: 0,
    desc: 'Declare ser o Político e pegue 3 moedas do banco.',
    tag: 'Blefe possível',
    tagColor: 'blue',
  },
  {
    name: 'Pegar o Arrego (Bicheiro)',
    cost: 0,
    desc: 'Declare ser o Bicheiro e roube 2 moedas de um alvo. Bloqueável pelo Juiz ou Miliciano.',
    tag: 'Blefe possível',
    tagColor: 'blue',
  },
  {
    name: 'Mandar pro Vasco (Bandido)',
    cost: 3,
    desc: 'Pague 3 moedas e declare ser o Bandido para eliminar 1 influência do alvo. Pode ser bloqueado pelo Miliciano.',
    tag: 'Blefe possível',
    tagColor: 'blue',
  },
  {
    name: 'Veredito (Juiz)',
    cost: 5,
    desc: 'Pague 5 moedas e acuse um jogador de ter um personagem. Acertou → alvo perde a influência. Errou → Juiz perde as moedas sem efeito.',
    tag: 'Blefe possível',
    tagColor: 'blue',
  },
  {
    name: 'Meter o X9 (X9)',
    cost: 0,
    desc: 'Declare ser o X9 e espia as cartas de outro jogador. Pode ser bloqueado pelo Juiz.',
    tag: 'Blefe possível',
    tagColor: 'blue',
  },
  {
    name: 'Disfarce (X9)',
    cost: 0,
    desc: 'Declare ser o X9 e troque suas próprias cartas com o baralho. Não pode ser bloqueada.',
    tag: 'Blefe possível',
    tagColor: 'blue',
  },
  {
    name: 'Infiltrar (X9)',
    cost: 0,
    desc: 'Declare ser o X9 e force um alvo a trocar uma de suas cartas com o baralho. Pode ser bloqueado pelo Juiz.',
    tag: 'Blefe possível',
    tagColor: 'blue',
  },
];

/* ── Componente ──────────────────────────────────────────────────────── */
export default function HowToPlayModal({ onClose }) {
  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <AnimatePresence>
      <motion.div
        className={styles.overlay}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className={styles.modal}
          initial={{ opacity: 0, y: 40, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.97 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className={styles.header}>
            <h2 className={styles.title}>📖 Como Jogar</h2>
            <button className={styles.closeBtn} onClick={onClose}>✕</button>
          </div>

          {/* Body */}
          <div className={styles.body}>

            {/* Objetivo */}
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>🎯 Objetivo</h3>
              <p className={styles.text}>
                Seja o <strong>último jogador com influência</strong> no jogo.
                Cada jogador começa com <strong>2 cartas de personagem</strong> (suas influências) e{' '}
                <strong>1 moeda</strong>. Perca as 2 cartas e você está eliminado.
              </p>
            </section>

            {/* Como começa */}
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>🃏 Como começa</h3>
              <ul className={styles.list}>
                <li>Cada jogador recebe <strong>2 cartas secretas</strong> de personagem e <strong>1 moeda</strong>.</li>
                <li>As cartas ficam <strong>viradas para baixo</strong> — só você vê as suas.</li>
                <li>Os turnos passam em sequência. No seu turno, escolha <strong>1 ação</strong>.</li>
                <li>Você pode <strong>blefar</strong> sobre qual personagem tem — mas cuidado com os Duvidus!</li>
              </ul>
            </section>

            {/* Ações */}
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>⚡ Ações</h3>
              <div className={styles.actionGrid}>
                {ACTIONS.map(a => (
                  <div key={a.name} className={styles.actionCard}>
                    <div className={styles.actionHeader}>
                      <span className={styles.actionName}>{a.name}</span>
                      {a.cost > 0 && <span className={styles.actionCost}>💰 {a.cost}</span>}
                      <span className={`${styles.actionTag} ${styles[`tag_${a.tagColor}`]}`}>{a.tag}</span>
                    </div>
                    <p className={styles.actionDesc}>{a.desc}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Personagens */}
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>🎭 Personagens</h3>
              <div className={styles.charGrid}>
                {CHARS.map(c => (
                  <div key={c.name} className={styles.charCard} style={{ borderColor: c.color + '55' }}>
                    <div className={styles.charHeader} style={{ background: c.color + '22' }}>
                      <span className={styles.charEmoji}>{c.emoji}</span>
                      <span className={styles.charName}>{c.name}</span>
                    </div>
                    <div className={styles.charBody}>
                      <p className={styles.charAbility}>
                        <strong>Ação:</strong> <em>{c.ability}</em> — {c.desc}
                      </p>
                      {c.block && (
                        <p className={styles.charBlock}>
                          <strong>🛡️ Bloqueia:</strong> {c.block}
                        </p>
                      )}
                      {c.blocked && (
                        <p className={styles.charBlocked}>
                          <strong>⚠️ Vulnerável:</strong> {c.blocked}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Blefe e Dúvida */}
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>🃏 Blefe e Dúvida</h3>
              <p className={styles.text}>
                Qualquer ação ou bloqueio que usa um personagem pode ser <strong>desafiado</strong>.
                Outro jogador pode dizer <em>"Duvido!"</em> antes da ação acontecer.
              </p>
              <ul className={styles.list}>
                <li><strong>Você estava blefando?</strong> Perde 1 influência (vira uma carta). A ação não acontece.</li>
                <li><strong>Você não estava blefando?</strong> Quem duvidou perde 1 influência. Você devolve a carta revelada ao baralho e pega uma nova.</li>
              </ul>
              <p className={styles.tip}>
                💡 <strong>Dica:</strong> Blefar bem é metade do jogo. Mas desafie na hora certa — um desafio errado pode te eliminar!
              </p>
            </section>

            {/* Coin Flip */}
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>🪙 Coin Flip (Miliciano vs Bicheiro)</h3>
              <p className={styles.text}>
                Quando o <strong>Miliciano</strong> tenta bloquear o roubo do <strong>Bicheiro</strong>:
              </p>
              <ul className={styles.list}>
                <li>O Miliciano paga <strong>1 moeda</strong> para tentar bloquear.</li>
                <li>🦅 <strong>Cara</strong> → bloqueio vale, o Miliciano <strong>recupera a moeda</strong>.</li>
                <li>🐉 <strong>Coroa</strong> → bloqueio falha, o Miliciano <strong>perde a moeda</strong> e o Bicheiro rouba normalmente.</li>
              </ul>
            </section>

            {/* Bloqueios */}
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>🛡️ Bloqueios</h3>
              <p className={styles.text}>
                Certos personagens podem <strong>bloquear</strong> ações antes que aconteçam.
                O bloqueio também pode ser desafiado — se o bloqueador estiver blefando, perde 1 influência e a ação acontece normalmente.
              </p>
            </section>

            {/* Dicas */}
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>💡 Dicas para Novatos</h3>
              <ul className={styles.list}>
                <li>Com <strong>7+ moedas</strong> você pode executar um Golpe de Estado. Com <strong>10 é obrigatório</strong>.</li>
                <li><strong>Guarde suas cartas em segredo</strong> — nunca revele de graça o que você tem.</li>
                <li>O <strong>Juiz é poderoso</strong>: bloqueia Bicheiro e X9 E ainda pode condenar com Veredito.</li>
                <li>O <strong>X9</strong> com 3 ações é o mais versátil — espia, se disfarça e força trocas.</li>
                <li>Com 1 influência, seja cauteloso. Um único erro pode te eliminar.</li>
                <li>Às vezes <strong>não blefar</strong> desorienta os adversários que esperam golpes.</li>
              </ul>
            </section>

          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
