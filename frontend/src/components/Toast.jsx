import { createContext, useContext, useState, useCallback } from 'react'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'

const ToastContext = createContext(null)
export function useToast() { return useContext(ToastContext) }

const ICONS = {
  success: CheckCircle,
  error:   XCircle,
  warning: AlertTriangle,
  info:    Info,
}
const COLORS = {
  success: { color: 'var(--success)',  bg: 'var(--success-bg)',  border: 'var(--success-border)' },
  error:   { color: 'var(--danger)',   bg: 'var(--danger-bg)',   border: 'var(--danger-border)' },
  warning: { color: 'var(--warning)',  bg: 'var(--warning-bg)',  border: 'var(--warning-border)' },
  info:    { color: 'var(--info)',     bg: 'var(--info-bg)',     border: 'var(--info-border)' },
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const toast = useCallback((message, type = 'info', duration = 3500) => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration)
  }, [])

  const dismiss = useCallback(id => setToasts(prev => prev.filter(t => t.id !== id)), [])

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div style={{
        position: 'fixed', bottom: '1.5rem', right: '1.5rem',
        zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '0.5rem',
        pointerEvents: 'none',
      }}>
        {toasts.map(t => {
          const c    = COLORS[t.type] || COLORS.info
          const Icon = ICONS[t.type]  || Info
          return (
            <div key={t.id} style={{
              display: 'flex', alignItems: 'flex-start', gap: '0.625rem',
              padding: '0.75rem 1rem',
              background: c.bg, border: `1px solid ${c.border}`,
              borderRadius: 'var(--r-md)',
              boxShadow: 'var(--shadow-md)',
              minWidth: '260px', maxWidth: '360px',
              pointerEvents: 'auto',
              animation: 'fadeInUp 0.22s ease-out',
            }}>
              <Icon size={15} color={c.color} style={{ flexShrink: 0, marginTop: '1px' }} />
              <span style={{ fontSize: '0.82rem', color: 'var(--text-1)', flex: 1, lineHeight: 1.5 }}>
                {t.message}
              </span>
              <button
                onClick={() => dismiss(t.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: '0', flexShrink: 0 }}
              >
                <X size={13} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
