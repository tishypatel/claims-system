import { useState, useRef, useEffect } from 'react'
import { Info } from 'lucide-react'

export default function AITooltip({ sections = [], title, align = 'right' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const hasSections = sections.some(s => s.items?.length > 0)
  if (!hasSections) return null

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <button
        type="button"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onClick={() => setOpen(v => !v)}
        title="AI reasoning"
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: '16px', height: '16px',
          background: 'var(--accent-bg)', border: '1px solid var(--accent-border)',
          borderRadius: '50%', cursor: 'pointer', color: 'var(--accent)',
          flexShrink: 0, padding: 0,
        }}
      >
        <Info size={9} />
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          bottom: 'calc(100% + 8px)',
          [align === 'right' ? 'right' : 'left']: 0,
          width: '290px',
          maxHeight: '340px',
          overflowY: 'auto',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r-md)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          padding: '0.875rem',
          zIndex: 500,
          pointerEvents: 'auto',
        }}>
          {title && (
            <p style={{
              fontSize: '0.67rem', fontWeight: 700, color: 'var(--accent)',
              letterSpacing: '0.06em', textTransform: 'uppercase',
              marginBottom: '0.625rem', paddingBottom: '0.5rem',
              borderBottom: '1px solid var(--border)',
            }}>
              {title}
            </p>
          )}
          {sections.map((section, i) =>
            section.items?.length > 0 ? (
              <div key={i} style={{ marginBottom: i < sections.length - 1 ? '0.75rem' : 0 }}>
                <p style={{
                  fontSize: '0.62rem', fontWeight: 700,
                  color: section.color || 'var(--text-3)',
                  letterSpacing: '0.06em', textTransform: 'uppercase',
                  marginBottom: '0.3rem',
                }}>
                  {section.label}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  {section.items.map((item, j) => (
                    <p key={j} style={{ fontSize: '0.74rem', color: 'var(--text-2)', lineHeight: 1.5 }}>
                      {section.numbered ? `${j + 1}. ${item}` : `• ${item}`}
                    </p>
                  ))}
                </div>
              </div>
            ) : null,
          )}
        </div>
      )}
    </div>
  )
}
