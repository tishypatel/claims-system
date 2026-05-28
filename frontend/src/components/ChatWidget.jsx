import { useState, useRef, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { MessageCircle, X, Send, Bot } from 'lucide-react'
import axios from '../api'

const QUICK_ACTIONS = {
  guest: [
    { label: 'Check claim status', text: 'I want to check the status of my claim' },
    { label: 'How to file', text: 'How do I file a new insurance claim?' },
    { label: 'Documents needed', text: 'What documents do I need for a claim?' },
  ],
  claimant: [
    { label: 'My claims', text: 'What is the status of my claims?' },
    { label: 'Processing time', text: 'How long will my claim take to process?' },
    { label: 'Add documents', text: 'How do I upload documents to my claim?' },
  ],
  adjudicator: [
    { label: 'SLA overview', text: 'Which claims are approaching SLA deadlines?' },
    { label: 'High fraud risk', text: 'Which claims have high fraud risk?' },
    { label: 'Pending review', text: 'How many claims need review?' },
  ],
  manager: [
    { label: 'Portfolio summary', text: 'Give me a portfolio summary' },
    { label: 'Overdue SLAs', text: 'Which claims have breached their SLA?' },
    { label: 'Fraud overview', text: 'What is the current fraud risk level?' },
  ],
}

export default function ChatWidget() {
  const location = useLocation()
  const claimMatch = location.pathname.match(/^\/claims\/(\d+)$/)
  const detectedClaimId = claimMatch ? parseInt(claimMatch[1], 10) : null

  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  const user = (() => {
    try { return JSON.parse(localStorage.getItem('claims_user') || '{}') } catch { return {} }
  })()
  const role = user.role || 'guest'
  const email = user.email || ''
  const firstName = (user.name || '').split(' ')[0] || ''
  const quickActions = QUICK_ACTIONS[role] || QUICK_ACTIONS.guest

  // Initial greeting
  useEffect(() => {
    const greeting = role === 'guest'
      ? "Hi! I'm ClaimsHub Assistant. I can check claim status for you — just share your reference number. I can also answer questions about the claims process."
      : role === 'claimant'
      ? `Hi ${firstName || 'there'}! I can help you with your claims. What would you like to know?`
      : `Hello ${firstName || 'there'}! Ask me about your portfolio, SLA status, fraud risk, or any specific claim.`
    setMessages([{ role: 'assistant', content: greeting }])
  }, [])

  useEffect(() => {
    if (!open) return
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [open])

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Don't show on landing or login pages
  const hiddenPaths = ['/', '/login']
  if (hiddenPaths.includes(location.pathname)) return null

  async function sendMessage(text) {
    const content = (text ?? input).trim()
    if (!content || loading) return
    setInput('')

    const newMessages = [...messages, { role: 'user', content }]
    setMessages(newMessages)
    setLoading(true)

    try {
      // Skip the first assistant greeting when sending to backend (it's generated locally)
      const toSend = newMessages.slice(1)
      const { data } = await axios.post('/api/chat', {
        messages: toSend,
        role,
        email: email || undefined,
        claim_id: detectedClaimId || undefined,
      })
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: err.response?.data?.error || "Sorry, I'm having trouble responding right now. Please try again.",
        error: true,
      }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <style>{`
        @keyframes chat-slide-up {
          from { opacity: 0; transform: translateY(12px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)  scale(1); }
        }
        @keyframes typing-dot {
          0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
          30%            { opacity: 1;   transform: translateY(-3px); }
        }
      `}</style>

      {/* Chat panel */}
      {open && (
        <div style={{
          position: 'fixed', bottom: '5.5rem', right: '1.25rem',
          width: 'min(340px, calc(100vw - 2rem))',
          height: 'min(500px, calc(100vh - 8rem))',
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: '16px', boxShadow: '0 8px 40px rgba(0,0,0,0.2)',
          display: 'flex', flexDirection: 'column',
          zIndex: 9998,
          animation: 'chat-slide-up 0.2s ease',
        }}>

          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.625rem',
            padding: '0.875rem 1rem',
            borderBottom: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '16px 16px 0 0',
            background: 'var(--accent)',
            flexShrink: 0,
          }}>
            <div style={{
              width: '30px', height: '30px', borderRadius: '50%',
              background: 'rgba(255,255,255,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Bot size={15} color="white" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: '0.82rem', fontWeight: 700, color: 'white', letterSpacing: '-0.01em' }}>
                ClaimsHub Assistant
              </p>
              <p style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.7)' }}>
                {role === 'guest' ? 'Public — no login required' : `${role.charAt(0).toUpperCase() + role.slice(1)} mode`}
              </p>
            </div>
            <button
              onClick={() => setOpen(false)}
              style={{ background: 'rgba(255,255,255,0.2)', border: 'none', cursor: 'pointer', color: 'white', padding: '0.3rem', borderRadius: '6px', display: 'flex', flexShrink: 0 }}
            >
              <X size={14} />
            </button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {messages.map((msg, i) => (
              <div key={i} style={{ display: 'flex', gap: '0.4rem', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', alignItems: 'flex-end' }}>
                {msg.role === 'assistant' && (
                  <div style={{
                    width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0,
                    background: 'var(--accent-bg)', border: '1px solid var(--accent-border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Bot size={11} color="var(--accent)" />
                  </div>
                )}
                <div style={{
                  maxWidth: '78%',
                  padding: '0.5rem 0.75rem',
                  borderRadius: msg.role === 'user' ? '14px 14px 3px 14px' : '14px 14px 14px 3px',
                  background: msg.role === 'user'
                    ? 'var(--accent)'
                    : msg.error
                    ? 'var(--danger-bg)'
                    : 'var(--surface-2)',
                  border: `1px solid ${
                    msg.role === 'user' ? 'transparent'
                    : msg.error ? 'var(--danger-border)'
                    : 'var(--border)'
                  }`,
                  fontSize: '0.8rem',
                  color: msg.role === 'user' ? 'white' : msg.error ? 'var(--danger-text)' : 'var(--text-1)',
                  lineHeight: 1.55,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}>
                  {msg.content}
                </div>
                {msg.role === 'user' && (
                  <div style={{
                    width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0,
                    background: 'var(--surface-2)', border: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-2)',
                  }}>
                    {(user.name || 'G').charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'flex-end' }}>
                <div style={{
                  width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0,
                  background: 'var(--accent-bg)', border: '1px solid var(--accent-border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Bot size={11} color="var(--accent)" />
                </div>
                <div style={{
                  padding: '0.55rem 0.875rem',
                  background: 'var(--surface-2)', border: '1px solid var(--border)',
                  borderRadius: '14px 14px 14px 3px',
                  display: 'flex', gap: '3px', alignItems: 'center',
                }}>
                  {[0, 1, 2].map(i => (
                    <span key={i} style={{
                      width: '5px', height: '5px', borderRadius: '50%',
                      background: 'var(--text-3)', display: 'inline-block',
                      animation: `typing-dot 1.2s ease-in-out ${i * 0.2}s infinite`,
                    }} />
                  ))}
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Quick actions — only show when conversation is fresh */}
          {messages.length <= 1 && (
            <div style={{ padding: '0 0.875rem 0.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.35rem', flexShrink: 0 }}>
              {quickActions.map((a, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(a.text)}
                  disabled={loading}
                  style={{
                    padding: '0.25rem 0.55rem', fontSize: '0.7rem', fontWeight: 500,
                    background: 'var(--surface-2)', border: '1px solid var(--border)',
                    borderRadius: '99px', cursor: 'pointer', color: 'var(--text-2)',
                    fontFamily: 'inherit', transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-2)' }}
                >
                  {a.label}
                </button>
              ))}
            </div>
          )}

          {/* Input row */}
          <div style={{
            padding: '0.75rem',
            borderTop: '1px solid var(--border)',
            display: 'flex', gap: '0.5rem', flexShrink: 0,
          }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
              placeholder={role === 'guest' ? 'Ask a question or enter reference no…' : 'Ask me anything…'}
              disabled={loading}
              style={{
                flex: 1, padding: '0.5rem 0.75rem',
                background: 'var(--surface-2)', border: '1px solid var(--border)',
                borderRadius: '8px', fontSize: '0.8rem', color: 'var(--text-1)',
                outline: 'none', fontFamily: 'inherit',
                transition: 'border-color 0.15s ease',
              }}
              onFocus={e => { e.target.style.borderColor = 'var(--accent)' }}
              onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading}
              style={{
                width: '36px', height: '36px', borderRadius: '8px',
                background: 'var(--accent)', border: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: !input.trim() || loading ? 'not-allowed' : 'pointer',
                opacity: !input.trim() || loading ? 0.45 : 1,
                transition: 'opacity 0.15s ease', flexShrink: 0,
              }}
            >
              <Send size={14} color="white" />
            </button>
          </div>
        </div>
      )}

      {/* Floating toggle button */}
      <button
        onClick={() => setOpen(v => !v)}
        title="AI Assistant"
        style={{
          position: 'fixed', bottom: '1.25rem', right: '1.25rem',
          width: '52px', height: '52px', borderRadius: '50%',
          background: 'var(--accent)', border: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 4px 16px rgba(0,0,0,0.22), 0 1px 4px rgba(0,0,0,0.1)',
          zIndex: 9999, transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)'; e.currentTarget.style.boxShadow = '0 6px 22px rgba(0,0,0,0.28)' }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.22), 0 1px 4px rgba(0,0,0,0.1)' }}
      >
        {open ? <X size={20} color="white" /> : <MessageCircle size={22} color="white" />}
      </button>
    </>
  )
}
