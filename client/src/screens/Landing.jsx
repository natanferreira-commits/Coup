import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './Landing.module.css';

/* ─── Animation helpers ───────────────────────────────────────────── */
const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
};
const stagger = (delay = 0) => ({
  hidden: {},
  show:   { transition: { staggerChildren: 0.11, delayChildren: delay } },
});

/* ─── FAQ data ────────────────────────────────────────────────────── */
const FAQ = [
  {
    q: 'O GOLPE é gratuito?',
    a: 'Sim, completamente gratuito. Crie uma sala, compartilhe o código e jogue com seus amigos sem precisar de conta.',
  },
  {
    q: 'Quantos jogadores precisam para jogar?',
    a: 'De 2 a 6 jogadores. A experiência é mais rica com 4 ou mais, mas partidas 2v2 também são intensas.',
  },
  {
    q: 'Preciso instalar alguma coisa?',
    a: 'Não. O GOLPE roda direto no navegador, em qualquer dispositivo — celular, tablet ou computador.',
  },
  {
    q: 'Como funciona a lista de pré-lançamento?',
    a: 'Ao se cadastrar você recebe notificações sobre novas funcionalidades, torneios e novidades antes de todo mundo.',
  },
  {
    q: 'Vão ter novos personagens e modos de jogo?',
    a: 'Sim! Estamos desenvolvendo expansões, modos ranqueados e muito mais. Cadastre-se para acompanhar tudo em primeira mão.',
  },
];

/* ─── How it works steps ──────────────────────────────────────────── */
const STEPS = [
  { n: '01', title: 'Crie ou entre em uma sala',    body: 'Gere um código de 4 letras e compartilhe com seus amigos. Nada de cadastro.' },
  { n: '02', title: 'Escolha sua estratégia',       body: 'Cada turno você decide: age honestamente, blefe com um personagem que não tem, ou bloqueie o adversário.' },
  { n: '03', title: 'Desafie ou seja desafiado',    body: 'Qualquer jogador pode questionar seu blefe. Se o desafio for certo, você perde uma influência. Se errado, o desafiante paga o preço.' },
  { n: '04', title: 'Último de pé vence',           body: 'Quando você perde suas duas influências está eliminado. O último jogador que sobrar no campo ganha a partida.' },
];

/* ─── Characters ──────────────────────────────────────────────────── */
const CHARS = [
  { name: 'Político',  color: '#1565c0', desc: 'Recebe imposto e distribui riqueza' },
  { name: 'Bicheiro',  color: '#b97916', desc: 'Extorquista nato, drena recursos alheios' },
  { name: 'X9',        color: '#6a1b9a', desc: 'Vê o que ninguém devia ver' },
  { name: 'Juiz',      color: '#1b5e20', desc: 'Garante que a lei valha — para ele mesmo' },
  { name: 'Miliciano', color: '#b71c1c', desc: 'Elimina sem hesitar, cobra caro por isso' },
  { name: 'Bandido',   color: '#4e342e', desc: 'Defesa de ferro contra bloqueios' },
];

/* ═══════════════════════════════════════════════════════════════════ */

export default function Landing({ onEnter }) {
  const [email,         setEmail]        = useState('');
  const [submitted,     setSubmitted]    = useState(false);
  const [emailError,    setEmailError]   = useState('');
  const [openFaq,       setOpenFaq]      = useState(null);
  const emailRef = useRef(null);

  function handleEmailSubmit(e) {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) {
      setEmailError('Digite um e-mail válido');
      return;
    }
    setEmailError('');
    setSubmitted(true);
    // TODO: send to backend / email service
  }

  function scrollToEmail() {
    emailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  return (
    <div className={styles.page}>

      {/* ── NAV ───────────────────────────────────────────────────────── */}
      <motion.nav
        className={styles.nav}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <span className={styles.navLogo}>GOLPE</span>
        <div className={styles.navLinks}>
          <button className={styles.navPlay} onClick={onEnter}>Jogar agora</button>
        </div>
      </motion.nav>

      {/* ── HERO ──────────────────────────────────────────────────────── */}
      <section className={styles.hero}>
        <div className={styles.heroBg} />
        <div className={styles.heroGlow} />

        <motion.div
          className={styles.heroContent}
          variants={stagger(0.1)}
          initial="hidden"
          animate="show"
        >
          <motion.p className={styles.eyebrow} variants={fadeUp}>
            🇧🇷 Jogo de cartas online • Até 6 jogadores
          </motion.p>

          <motion.h1 className={styles.heroTitle} variants={fadeUp}>
            GOLPE
          </motion.h1>

          <motion.p className={styles.heroSub} variants={fadeUp}>
            Blefe. Poder. Traição.
          </motion.p>

          <motion.p className={styles.heroDesc} variants={fadeUp}>
            Uma batalha de influências onde mentir é uma habilidade,
            desafiar é sobrevivência e confiar pode ser sua ruína.
          </motion.p>

          <motion.div className={styles.heroCtas} variants={fadeUp}>
            <motion.button
              className={styles.ctaPrimary}
              onClick={onEnter}
              whileHover={{ scale: 1.04, boxShadow: '0 0 60px rgba(232,162,41,0.5)' }}
              whileTap={{ scale: 0.97 }}
            >
              Jogar agora
              <motion.span
                animate={{ x: [0, 5, 0] }}
                transition={{ repeat: Infinity, duration: 1.4, ease: 'easeInOut' }}
              >→</motion.span>
            </motion.button>

            <motion.button
              className={styles.ctaSecondary}
              onClick={scrollToEmail}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              Entrar na lista
            </motion.button>
          </motion.div>
        </motion.div>

        {/* Hero visual placeholder — substitua pelo artwork do personagem */}
        <motion.div
          className={styles.heroArt}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.35, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className={styles.heroArtPlaceholder}>
            <span className={styles.heroArtLabel}>[ artwork do personagem ]</span>
          </div>
        </motion.div>
      </section>

      {/* ── O QUE É O GOLPE ────────────────────────────────────────────── */}
      <section className={styles.section}>
        <motion.div
          className={styles.whatGrid}
          variants={stagger()}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-80px' }}
        >
          <motion.div className={styles.whatText} variants={fadeUp}>
            <span className={styles.sectionLabel}>O que é o GOLPE</span>
            <h2 className={styles.sectionTitle}>Cada jogada<br />esconde uma armadilha</h2>
            <p className={styles.bodyText}>
              GOLPE é um jogo de cartas de mesa adaptado para o universo brasileiro. Você
              controla dois personagens secretos — cada um com habilidades únicas — e usa
              (ou finge usar) seus poderes para eliminar os adversários.
            </p>
            <p className={styles.bodyText}>
              O segredo? Ninguém sabe quem você é de verdade. Você pode blefar qualquer
              personagem que não tem, desde que ninguém te desafie. E se desafiarem…
              que Deus o ajude.
            </p>
            <div className={styles.stats}>
              {[
                { n: '6',   label: 'personagens' },
                { n: '2–6', label: 'jogadores'   },
                { n: '~15', label: 'min/partida'  },
              ].map(s => (
                <div key={s.label} className={styles.stat}>
                  <span className={styles.statNum}>{s.n}</span>
                  <span className={styles.statLabel}>{s.label}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Card mockup placeholder — substitua pelo seu mockup */}
          <motion.div className={styles.whatVisual} variants={fadeUp}>
            <div className={styles.cardMockupPlaceholder}>
              <span className={styles.heroArtLabel}>[ mockup das cartas ]</span>
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* ── COMO FUNCIONA ─────────────────────────────────────────────── */}
      <section className={`${styles.section} ${styles.sectionDark}`}>
        <motion.div
          className={styles.sectionHeader}
          variants={stagger()}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-60px' }}
        >
          <motion.span className={styles.sectionLabel} variants={fadeUp}>Como funciona</motion.span>
          <motion.h2 className={styles.sectionTitle} variants={fadeUp}>Simples de aprender,<br />difícil de dominar</motion.h2>
        </motion.div>

        <motion.div
          className={styles.stepsGrid}
          variants={stagger(0.05)}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-60px' }}
        >
          {STEPS.map(step => (
            <motion.div key={step.n} className={styles.stepCard} variants={fadeUp}>
              <span className={styles.stepNum}>{step.n}</span>
              <h3 className={styles.stepTitle}>{step.title}</h3>
              <p className={styles.stepBody}>{step.body}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ── PERSONAGENS ───────────────────────────────────────────────── */}
      <section className={styles.section}>
        <motion.div
          className={styles.sectionHeader}
          variants={stagger()}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-60px' }}
        >
          <motion.span className={styles.sectionLabel} variants={fadeUp}>Personagens</motion.span>
          <motion.h2 className={styles.sectionTitle} variants={fadeUp}>Quem você vai ser?</motion.h2>
          <motion.p className={`${styles.bodyText} ${styles.centered}`} variants={fadeUp}>
            Seis figuras do poder brasileiro, cada uma com habilidades que mudam
            completamente a sua estratégia.
          </motion.p>
        </motion.div>

        <motion.div
          className={styles.charsGrid}
          variants={stagger(0.04)}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-60px' }}
        >
          {CHARS.map(c => (
            <motion.div
              key={c.name}
              className={styles.charCard}
              style={{ '--char-color': c.color }}
              variants={fadeUp}
              whileHover={{ y: -6, borderColor: c.color }}
              transition={{ type: 'spring', stiffness: 280, damping: 18 }}
            >
              {/* Placeholder — substitua pelo artwork do personagem */}
              <div className={styles.charArtPlaceholder} />
              <div className={styles.charInfo}>
                <span className={styles.charName}>{c.name}</span>
                <span className={styles.charDesc}>{c.desc}</span>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ── EMAIL SIGNUP ──────────────────────────────────────────────── */}
      <section className={`${styles.section} ${styles.emailSection}`} ref={emailRef}>
        <div className={styles.emailGlow} />
        <motion.div
          className={styles.emailBox}
          variants={stagger()}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-60px' }}
        >
          <motion.span className={styles.sectionLabel} variants={fadeUp}>Pré-lançamento</motion.span>
          <motion.h2 className={styles.sectionTitle} variants={fadeUp}>
            Entre na lista<br />antes de todo mundo
          </motion.h2>
          <motion.p className={`${styles.bodyText} ${styles.centered}`} variants={fadeUp}>
            Cadastre seu e-mail e seja o primeiro a saber sobre novas funcionalidades,
            modos de jogo, torneios e muito mais.
          </motion.p>

          <motion.div className={styles.perks} variants={fadeUp}>
            {['Acesso antecipado a novos modos', 'Notificações de torneios', 'Personagens exclusivos em breve'].map(p => (
              <div key={p} className={styles.perk}>
                <span className={styles.perkCheck}>✓</span>
                <span>{p}</span>
              </div>
            ))}
          </motion.div>

          <AnimatePresence mode="wait">
            {submitted ? (
              <motion.div
                key="success"
                className={styles.emailSuccess}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
              >
                <span className={styles.successIcon}>🎉</span>
                <p>Você está na lista! Te avisamos quando tiver novidade.</p>
              </motion.div>
            ) : (
              <motion.form
                key="form"
                className={styles.emailForm}
                onSubmit={handleEmailSubmit}
                variants={fadeUp}
              >
                <div className={styles.emailInputRow}>
                  <input
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className={styles.emailInput}
                  />
                  <motion.button
                    type="submit"
                    className={styles.emailBtn}
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    Entrar na lista
                  </motion.button>
                </div>
                {emailError && <p className={styles.emailError}>{emailError}</p>}
                <p className={styles.emailDisclaimer}>Sem spam. Cancele quando quiser.</p>
              </motion.form>
            )}
          </AnimatePresence>
        </motion.div>
      </section>

      {/* ── SOCIAL PROOF ──────────────────────────────────────────────── */}
      <section className={styles.section}>
        <motion.div
          className={styles.sectionHeader}
          variants={stagger()}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-60px' }}
        >
          <motion.span className={styles.sectionLabel} variants={fadeUp}>O que estão dizendo</motion.span>
        </motion.div>
        <motion.div
          className={styles.quotesGrid}
          variants={stagger(0.08)}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-60px' }}
        >
          {[
            { quote: 'Quebramos a amizade de 10 anos em uma partida. Recomendo.', author: 'João P., São Paulo' },
            { quote: 'Minha nova obsessão. Joguei 6 rodadas seguidas e ainda queria mais.', author: 'Mariana L., Belo Horizonte' },
            { quote: 'Finalmente um jogo assim em português e com cara brasileira.', author: 'Rafael T., Recife' },
          ].map(({ quote, author }) => (
            <motion.div key={author} className={styles.quoteCard} variants={fadeUp}>
              <p className={styles.quoteText}>"{quote}"</p>
              <span className={styles.quoteAuthor}>— {author}</span>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────────────── */}
      <section className={`${styles.section} ${styles.sectionDark}`}>
        <motion.div
          className={styles.sectionHeader}
          variants={stagger()}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-60px' }}
        >
          <motion.span className={styles.sectionLabel} variants={fadeUp}>FAQ</motion.span>
          <motion.h2 className={styles.sectionTitle} variants={fadeUp}>Perguntas frequentes</motion.h2>
        </motion.div>

        <motion.div
          className={styles.faqList}
          variants={stagger(0.06)}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-60px' }}
        >
          {FAQ.map((item, i) => (
            <motion.div key={i} className={styles.faqItem} variants={fadeUp}>
              <button
                className={styles.faqQuestion}
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
              >
                <span>{item.q}</span>
                <motion.span
                  className={styles.faqChevron}
                  animate={{ rotate: openFaq === i ? 180 : 0 }}
                  transition={{ duration: 0.25 }}
                >▾</motion.span>
              </button>
              <AnimatePresence>
                {openFaq === i && (
                  <motion.p
                    className={styles.faqAnswer}
                    initial={{ opacity: 0, height: 0, paddingTop: 0, paddingBottom: 0 }}
                    animate={{ opacity: 1, height: 'auto', paddingTop: 12, paddingBottom: 16 }}
                    exit={{ opacity: 0, height: 0, paddingTop: 0, paddingBottom: 0 }}
                    transition={{ duration: 0.28, ease: 'easeInOut' }}
                  >
                    {item.a}
                  </motion.p>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────────────── */}
      <footer className={styles.footer}>
        <span className={styles.footerLogo}>GOLPE</span>
        <p className={styles.footerSub}>2–6 jogadores · online · grátis</p>
        <button className={styles.footerPlay} onClick={onEnter}>Jogar agora →</button>
        <p className={styles.footerCopy}>© 2025 GOLPE. Todos os direitos reservados.</p>
      </footer>

    </div>
  );
}
