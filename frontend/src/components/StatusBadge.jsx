const config = {
  pending:      { color: 'var(--warning)',  bg: 'var(--warning-bg)',  border: 'var(--warning-border)',  label: 'Pending' },
  under_review: { color: 'var(--info)',     bg: 'var(--info-bg)',     border: 'var(--info-border)',     label: 'Under Review' },
  approved:     { color: 'var(--success)',  bg: 'var(--success-bg)',  border: 'var(--success-border)',  label: 'Approved' },
  rejected:     { color: 'var(--danger)',   bg: 'var(--danger-bg)',   border: 'var(--danger-border)',   label: 'Rejected' },
  closed:       { color: 'var(--muted)',    bg: 'var(--muted-bg)',    border: 'var(--muted-border)',    label: 'Closed' },
}

export default function StatusBadge({ status, size = 'sm' }) {
  const c = config[status] || config.pending
  const padX = size === 'lg' ? '0.65rem' : '0.5rem'
  const padY = size === 'lg' ? '0.3rem'  : '0.18rem'
  const fs   = size === 'lg' ? '0.8rem'  : '0.7rem'
  const dot  = size === 'lg' ? '6px'     : '5px'

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
      padding: `${padY} ${padX}`,
      borderRadius: '99px',
      fontSize: fs, fontWeight: 600,
      background: c.bg, color: c.color,
      border: `1px solid ${c.border}`,
      whiteSpace: 'nowrap',
    }}>
      <span style={{
        width: dot, height: dot, borderRadius: '50%',
        background: c.color, flexShrink: 0,
        ...(status === 'pending' || status === 'under_review'
          ? { animation: 'pulse-dot 2s ease-in-out infinite' }
          : {}),
      }} />
      {c.label}
    </span>
  )
}
