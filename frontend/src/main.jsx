import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Handle SPA refresh 404 redirects.
// If the browser was bounced through public/404.html (Vercel static 404 fallback),
// the original path is stored in sessionStorage. Restore it now, before React Router
// initialises, so the router sees the correct URL straight away.
const spaRedirect = sessionStorage.getItem('_spa_redirect')
if (spaRedirect) {
  sessionStorage.removeItem('_spa_redirect')
  window.history.replaceState(null, null, spaRedirect)
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
