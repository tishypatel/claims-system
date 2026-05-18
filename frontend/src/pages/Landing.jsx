import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ShieldCheck, Sun, Moon, Zap, Clock, Users, BarChart3,
  Shield, ArrowRight, CheckCircle, FileText, Search, Bell, Lock,
} from 'lucide-react'
import { useTheme } from '../App'

/* ── Scroll-reveal hook ─────────────────────────────────────── */
function useReveal(threshold = 0.15) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect() } },
      { threshold }
    )
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [])
  return [ref, visible]
}

/* ── Animated counter hook ──────────────────────────────────── */
function useCounter(target, started, duration = 1800) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!started) return
    const t0 = Date.now()
    const id = setInterval(() => {
      const p = Math.min((Date.now() - t0) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setVal(Math.floor(eased * target))
      if (p >= 1) clearInterval(id)
    }, 16)
    return () => clearInterval(id)
  }, [started, target, duration])
  return val
}

/* ── Floating blueprint square ──────────────────────────────── */
function Square({ size, style, delay, duration, inner = false }) {
  return (
    <div style={{
      position: 'absolute',
      width: size, height: size,
      border: '1.5px dashed var(--grid-accent)',
      borderRadius: '4px',
      animation: `bp-float ${duration}s ease-in-out ${delay}s infinite`,
      ...style,
    }}>
      {inner && (
        <div style={{
          position: 'absolute',
          inset: 14,
          border: '1px dashed var(--grid-accent)',
          borderRadius: '2px',
        }} />
      )}
      {/* Corner marks */}
      {[
        { top: -4, left: -4 }, { top: -4, right: -4 },
        { bottom: -4, left: -4 }, { bottom: -4, right: -4 },
      ].map((pos, i) => (
        <div key={i} style={{
          position: 'absolute', width: 7, height: 7,
          borderTop: i < 2 ? '2px solid var(--grid-accent)' : 'none',
          borderBottom: i >= 2 ? '2px solid var(--grid-accent)' : 'none',
          borderLeft: i % 2 === 0 ? '2px solid var(--grid-accent)' : 'none',
          borderRight: i % 2 === 1 ? '2px solid var(--grid-accent)' : 'none',
          ...pos,
        }} />
      ))}
    </div>
  )
}

/* ── Feature card ───────────────────────────────────────────── */
function FeatureCard({ icon: Icon, title, desc, delay, visible }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--r-lg)',
      padding: '1.5rem',
      boxShadow: 'var(--shadow-sm)',
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(24px)',
      transition: `opacity 0.5s ease ${delay}ms, transform 0.5s ease ${delay}ms`,
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10,
        background: 'var(--accent-bg)',
        border: '1px solid var(--accent-border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: '1rem',
      }}>
        <Icon size={18} color="var(--accent)" />
      </div>
      <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-1)', marginBottom: '0.5rem' }}>{title}</h3>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-2)', lineHeight: 1.65 }}>{desc}</p>
    </div>
  )
}

/* ── Stat item ──────────────────────────────────────────────── */
function StatItem({ value, suffix, label, started }) {
  const count = useCounter(value, started)
  return (
    <div style={{ textAlign: 'center' }}>
      <p style={{ fontSize: '2.25rem', fontWeight: 800, color: 'var(--accent)', letterSpacing: '-0.03em', lineHeight: 1 }}>
        {count.toLocaleString()}{suffix}
      </p>
      <p style={{ fontSize: '0.82rem', color: 'var(--text-2)', marginTop: '0.375rem', fontWeight: 500 }}>{label}</p>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════ */
export default function Landing() {
  const navigate = useNavigate()
  const { dark, toggle } = useTheme()
  const [scrolled, setScrolled] = useState(false)

  const [heroRef, heroVisible]         = useReveal(0.1)
  const [statsRef, statsVisible]       = useReveal(0.3)
  const [featuresRef, featuresVisible] = useReveal(0.1)
  const [stepsRef, stepsVisible]       = useReveal(0.15)
  const [ctaRef, ctaVisible]           = useReveal(0.2)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const features = [
    { icon: Zap,       title: 'Real-time Processing',   desc: 'Claims are triaged and routed instantly the moment they are submitted, eliminating manual queuing delays.' },
    { icon: Search,    title: 'Smart Adjudication',     desc: 'Role-based workflows guide adjusters through every decision with built-in checklists and policy lookups.' },
    { icon: BarChart3, title: 'Live Analytics',         desc: 'Dashboards give managers full visibility into pipeline health, cycle times, and exposure at a glance.' },
    { icon: Users,     title: 'Role-based Access',      desc: 'Granular permissions ensure claimants, adjusters, and managers each see exactly what they need.' },
    { icon: FileText,  title: 'Full Audit Trail',       desc: 'Every status change, note, and decision is time-stamped and attributed — perfect for compliance audits.' },
    { icon: Lock,      title: 'Secure by Default',      desc: 'Industry-standard encryption at rest and in transit. Your data never leaves your control.' },
  ]

  const steps = [
    { icon: FileText,    num: '01', title: 'Submit',  desc: 'Claimants fill a guided form in minutes. Required fields, smart validation, and instant confirmation.' },
    { icon: Search,      num: '02', title: 'Review',  desc: 'The claim lands in the adjudicator queue. Review evidence, communicate with claimants, add notes.' },
    { icon: CheckCircle, num: '03', title: 'Decide',  desc: 'Approve or reject with a mandatory reason. All parties notified instantly. Audit log updated.' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', overflowX: 'hidden', position: 'relative' }}>

      {/* ── Blueprint background ─────────────────────────────── */}
      <div aria-hidden style={{
        position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
        backgroundImage: `
          linear-gradient(var(--grid-major) 1px, transparent 1px),
          linear-gradient(90deg, var(--grid-major) 1px, transparent 1px),
          linear-gradient(var(--grid-minor) 1px, transparent 1px),
          linear-gradient(90deg, var(--grid-minor) 1px, transparent 1px)
        `,
        backgroundSize: '80px 80px, 80px 80px, 20px 20px, 20px 20px',
        backgroundPosition: '-1px -1px, -1px -1px, -1px -1px, -1px -1px',
      }} />

      {/* ── Floating blueprint squares ───────────────────────── */}
      <div aria-hidden style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        <Square size={110} delay={0}   duration={9}  inner style={{ top: '7%',  left: '3%' }} />
        <Square size={75}  delay={1.8} duration={11} style={{ top: '18%', right: '4%' }} />
        <Square size={150} delay={0.6} duration={13} inner style={{ top: '55%', left: '1%' }} />
        <Square size={65}  delay={2.5} duration={8}  style={{ top: '42%', right: '6%' }} />
        <Square size={95}  delay={1.2} duration={10} style={{ top: '78%', left: '8%' }} />
        <Square size={130} delay={3}   duration={14} inner style={{ top: '30%', right: '2%' }} />
        <Square size={55}  delay={0.3} duration={7}  style={{ top: '65%', right: '10%' }} />
        <Square size={85}  delay={2}   duration={12} style={{ top: '88%', left: '45%' }} />
      </div>

      {/* ── Nav ─────────────────────────────────────────────── */}
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        height: 60,
        background: scrolled ? 'var(--surface)' : 'transparent',
        borderBottom: scrolled ? '1px solid var(--border)' : '1px solid transparent',
        boxShadow: scrolled ? 'var(--shadow-sm)' : 'none',
        display: 'flex', alignItems: 'center',
        padding: '0 2rem',
        transition: 'all 0.25s ease',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShieldCheck size={15} color="white" />
          </div>
          <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-1)', letterSpacing: '-0.01em' }}>ClaimsHub</span>
        </div>

        <nav style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginRight: '1.5rem' }}>
          {['Features', 'How it works', 'Pricing'].map(item => (
            <a key={item} href={`#${item.toLowerCase().replace(/ /g, '-')}`} style={{
              padding: '0.35rem 0.75rem', borderRadius: 6,
              fontSize: '0.85rem', fontWeight: 500,
              color: 'var(--text-2)', textDecoration: 'none',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-1)'; e.currentTarget.style.background = 'var(--surface-2)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-2)'; e.currentTarget.style.background = 'transparent' }}
            >
              {item}
            </a>
          ))}
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button onClick={toggle} style={{
            width: 32, height: 32, borderRadius: 7,
            background: 'var(--surface-2)', border: '1.5px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: 'var(--text-2)', transition: 'all 0.15s',
          }}>
            {dark ? <Sun size={14} /> : <Moon size={14} />}
          </button>
          <button onClick={() => navigate('/login')} style={{
            padding: '0.4rem 0.875rem', borderRadius: 6,
            background: 'transparent', border: '1.5px solid var(--border)',
            fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-1)',
            cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-2)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
          >
            Sign in
          </button>
          <button onClick={() => navigate('/login')} style={{
            padding: '0.4rem 0.875rem', borderRadius: 6,
            background: 'var(--accent)', border: 'none',
            fontSize: '0.85rem', fontWeight: 600, color: 'white',
            cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-hover)'}
          onMouseLeave={e => e.currentTarget.style.background = 'var(--accent)'}
          >
            Get started →
          </button>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section
        ref={heroRef}
        style={{ position: 'relative', zIndex: 1, paddingTop: '140px', paddingBottom: '100px', textAlign: 'center', padding: '140px 2rem 100px' }}
      >
        {/* Badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.3rem 0.875rem',
          background: 'var(--accent-bg)', border: '1px solid var(--accent-border)',
          borderRadius: 99, marginBottom: '1.75rem',
          opacity: heroVisible ? 1 : 0,
          transform: heroVisible ? 'translateY(0)' : 'translateY(16px)',
          transition: 'all 0.5s ease 0s',
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} />
          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--accent-text)' }}>Built for modern insurance teams</span>
        </div>

        {/* Headline */}
        <h1 style={{
          fontSize: 'clamp(2.5rem, 6vw, 4.25rem)',
          fontWeight: 900,
          color: 'var(--text-1)',
          letterSpacing: '-0.04em',
          lineHeight: 1.1,
          maxWidth: 780, margin: '0 auto 1.25rem',
          opacity: heroVisible ? 1 : 0,
          transform: heroVisible ? 'translateY(0)' : 'translateY(20px)',
          transition: 'all 0.55s ease 0.1s',
        }}>
          Claims management,{' '}
          <span style={{
            background: 'linear-gradient(135deg, var(--accent), var(--warning))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            reimagined
          </span>
        </h1>

        {/* Sub */}
        <p style={{
          fontSize: 'clamp(1rem, 2vw, 1.175rem)',
          color: 'var(--text-2)', maxWidth: 560, margin: '0 auto 2.5rem',
          lineHeight: 1.7,
          opacity: heroVisible ? 1 : 0,
          transform: heroVisible ? 'translateY(0)' : 'translateY(18px)',
          transition: 'all 0.55s ease 0.2s',
        }}>
          From first notice of loss to final decision — ClaimsHub gives your team
          a single, intelligent workspace to process, adjudicate, and close claims faster than ever.
        </p>

        {/* CTAs */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap',
          opacity: heroVisible ? 1 : 0,
          transform: heroVisible ? 'translateY(0)' : 'translateY(16px)',
          transition: 'all 0.55s ease 0.3s',
        }}>
          <button onClick={() => navigate('/login')} style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.75rem 1.625rem',
            background: 'var(--accent)', color: 'white',
            borderRadius: 8, border: 'none',
            fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer',
            fontFamily: 'inherit',
            boxShadow: '0 4px 24px var(--accent-border)',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-hover)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'var(--accent)'; e.currentTarget.style.transform = 'translateY(0)' }}
          >
            Start free trial <ArrowRight size={16} />
          </button>
          <button onClick={() => navigate('/login')} style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.75rem 1.625rem',
            background: 'var(--surface)', color: 'var(--text-1)',
            borderRadius: 8, border: '1.5px solid var(--border)',
            fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer',
            fontFamily: 'inherit',
            boxShadow: 'var(--shadow-sm)',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-2)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'translateY(0)' }}
          >
            See live demo
          </button>
        </div>

        {/* Floating trust badges */}
        <div style={{
          display: 'flex', justifyContent: 'center', gap: '0.75rem', marginTop: '2.5rem', flexWrap: 'wrap',
          opacity: heroVisible ? 1 : 0,
          transition: 'opacity 0.5s ease 0.45s',
        }}>
          {['SOC 2 Compliant', 'GDPR Ready', '99.9% Uptime', 'ISO 27001'].map(b => (
            <span key={b} style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
              padding: '0.25rem 0.75rem',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 99,
              fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-3)',
              boxShadow: 'var(--shadow-xs)',
            }}>
              <CheckCircle size={11} color="var(--success)" /> {b}
            </span>
          ))}
        </div>
      </section>

      {/* ── Stats bar ────────────────────────────────────────── */}
      <section
        ref={statsRef}
        id="pricing"
        style={{ position: 'relative', zIndex: 1, padding: '3.5rem 2rem' }}
      >
        <div style={{
          maxWidth: 900, margin: '0 auto',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r-lg)',
          boxShadow: 'var(--shadow-md)',
          padding: '2.5rem 3rem',
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '1rem',
        }}>
          {[
            { value: 54000,  suffix: '+', label: 'Claims Processed' },
            { value: 98,     suffix: '%', label: 'Accuracy Rate' },
            { value: 3,      suffix: 'x',  label: 'Faster Decisions' },
            { value: 120,    suffix: '+', label: 'Insurance Teams' },
          ].map((s, i) => (
            <div key={i} style={{
              textAlign: 'center',
              borderRight: i < 3 ? '1px solid var(--border)' : 'none',
              paddingRight: i < 3 ? '1rem' : 0,
            }}>
              <StatItem value={s.value} suffix={s.suffix} label={s.label} started={statsVisible} />
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────── */}
      <section
        ref={featuresRef}
        id="features"
        style={{ position: 'relative', zIndex: 1, padding: '5rem 2rem' }}
      >
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <p style={{
              fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em',
              textTransform: 'uppercase', color: 'var(--accent)', marginBottom: '0.75rem',
            }}>Features</p>
            <h2 style={{
              fontSize: 'clamp(1.625rem, 3.5vw, 2.375rem)',
              fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.03em',
              maxWidth: 520, margin: '0 auto',
            }}>
              Everything your team needs, nothing it doesn't
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
            {features.map((f, i) => (
              <FeatureCard key={i} {...f} delay={i * 80} visible={featuresVisible} />
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────── */}
      <section
        ref={stepsRef}
        id="how-it-works"
        style={{ position: 'relative', zIndex: 1, padding: '5rem 2rem' }}
      >
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <p style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: '0.75rem' }}>
              How it works
            </p>
            <h2 style={{ fontSize: 'clamp(1.625rem, 3.5vw, 2.375rem)', fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.03em' }}>
              Three steps to a closed claim
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', position: 'relative' }}>
            {/* Connector line */}
            <div style={{
              position: 'absolute', top: 40, left: '16.66%', right: '16.66%', height: 2,
              background: 'linear-gradient(90deg, var(--accent-border), var(--accent), var(--accent-border))',
              zIndex: 0,
            }} />

            {steps.map((s, i) => (
              <div key={i} style={{
                textAlign: 'center', padding: '2rem 1.5rem',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--r-lg)',
                boxShadow: 'var(--shadow-sm)',
                position: 'relative', zIndex: 1,
                opacity: stepsVisible ? 1 : 0,
                transform: stepsVisible ? 'translateY(0)' : 'translateY(28px)',
                transition: `opacity 0.5s ease ${i * 120}ms, transform 0.5s ease ${i * 120}ms`,
              }}>
                <div style={{
                  width: 56, height: 56, borderRadius: '50%', margin: '0 auto 1.25rem',
                  background: 'var(--accent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 4px 16px var(--accent-border)',
                }}>
                  <s.icon size={22} color="white" />
                </div>
                <div style={{
                  position: 'absolute', top: '1rem', right: '1rem',
                  fontSize: '0.7rem', fontWeight: 800, color: 'var(--accent)',
                  fontFamily: 'monospace', letterSpacing: '0.06em',
                }}>
                  {s.num}
                </div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-1)', marginBottom: '0.625rem' }}>{s.title}</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-2)', lineHeight: 1.65 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA section ──────────────────────────────────────── */}
      <section
        ref={ctaRef}
        style={{ position: 'relative', zIndex: 1, padding: '5rem 2rem 6rem' }}
      >
        <div style={{
          maxWidth: 720, margin: '0 auto', textAlign: 'center',
          padding: '3.5rem 3rem',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 20,
          boxShadow: 'var(--shadow-md)',
          position: 'relative', overflow: 'hidden',
          opacity: ctaVisible ? 1 : 0,
          transform: ctaVisible ? 'translateY(0)' : 'translateY(24px)',
          transition: 'all 0.55s ease',
        }}>
          {/* Accent corner decorations */}
          <div style={{ position: 'absolute', top: 0, left: 0, width: 80, height: 4, background: 'linear-gradient(90deg, var(--accent), transparent)' }} />
          <div style={{ position: 'absolute', top: 0, right: 0, width: 80, height: 4, background: 'linear-gradient(270deg, var(--accent), transparent)' }} />

          <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--accent)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem', boxShadow: '0 6px 20px var(--accent-border)' }}>
            <ShieldCheck size={24} color="white" />
          </div>
          <h2 style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)', fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.03em', marginBottom: '0.875rem' }}>
            Ready to streamline your claims process?
          </h2>
          <p style={{ fontSize: '0.95rem', color: 'var(--text-2)', maxWidth: 460, margin: '0 auto 2rem', lineHeight: 1.7 }}>
            Join 120+ insurance teams already using ClaimsHub. Set up in minutes, no credit card required.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => navigate('/login')} style={{
              padding: '0.75rem 1.75rem',
              background: 'var(--accent)', color: 'white',
              border: 'none', borderRadius: 8,
              fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer',
              fontFamily: 'inherit',
              boxShadow: '0 4px 20px var(--accent-border)',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-hover)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--accent)'; e.currentTarget.style.transform = 'translateY(0)' }}
            >
              Try ClaimsHub free
            </button>
            <button onClick={() => navigate('/login')} style={{
              padding: '0.75rem 1.75rem',
              background: 'transparent', color: 'var(--text-1)',
              border: '1.5px solid var(--border)', borderRadius: 8,
              fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer',
              fontFamily: 'inherit', transition: 'all 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-2)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              View live demo
            </button>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────── */}
      <footer style={{ position: 'relative', zIndex: 1, padding: '1.75rem 2rem', borderTop: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: 24, height: 24, borderRadius: 6, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldCheck size={13} color="white" />
            </div>
            <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-1)' }}>ClaimsHub</span>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-3)' }}>© 2026 QBE Insurance</span>
          </div>
          <div style={{ display: 'flex', gap: '1.5rem' }}>
            {['Privacy', 'Terms', 'Security', 'Contact'].map(l => (
              <a key={l} href="#" style={{ fontSize: '0.8rem', color: 'var(--text-3)', textDecoration: 'none', transition: 'color 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--text-1)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-3)'}
              >{l}</a>
            ))}
          </div>
        </div>
      </footer>

      {/* ── Animation styles ─────────────────────────────────── */}
      <style>{`
        :root {
          --grid-minor: rgba(180, 83, 9, 0.045);
          --grid-major: rgba(180, 83, 9, 0.09);
          --grid-accent: rgba(180, 83, 9, 0.18);
        }
        .dark {
          --grid-minor: rgba(232, 150, 26, 0.055);
          --grid-major: rgba(232, 150, 26, 0.11);
          --grid-accent: rgba(232, 150, 26, 0.22);
        }
        @keyframes bp-float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          33%       { transform: translateY(-14px) rotate(1.2deg); }
          66%       { transform: translateY(-6px) rotate(-0.8deg); }
        }
      `}</style>
    </div>
  )
}
