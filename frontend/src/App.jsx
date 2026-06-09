import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { createContext, useContext, useState, useEffect } from 'react'
import Login from './pages/Login'
import Landing from './pages/Landing'
import Dashboard from './pages/Dashboard'
import ClaimantPortal from './pages/ClaimantPortal'
import NewClaim from './pages/NewClaim'
import ClaimDetail from './pages/ClaimDetail'
import ClaimantClaimView from './pages/ClaimantClaimView'
import AdjusterWorkflow from './pages/AdjusterWorkflow'
import DecisionLetter from './pages/DecisionLetter'
import Layout from './components/Layout'
import { ToastProvider } from './components/Toast'
import ChatWidget from './components/ChatWidget'

export const ThemeContext = createContext(null)
export function useTheme() { return useContext(ThemeContext) }

function PrivateRoute({ children }) {
  const user = localStorage.getItem('claims_user')
  return user ? children : <Navigate to="/login" replace />
}

// Route claimants to their portal, adjudicators/managers to the standard dashboard
function DashboardRoute() {
  const user = JSON.parse(localStorage.getItem('claims_user') || '{}')
  return user.role === 'claimant' ? <ClaimantPortal /> : <Dashboard />
}

export default function App() {
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('claims_theme')
    if (saved) return saved === 'dark'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('claims_theme', dark ? 'dark' : 'light')
  }, [dark])

  return (
    <ThemeContext.Provider value={{ dark, toggle: () => setDark(d => !d) }}>
      <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
            {/* Shared */}
            <Route path="dashboard"              element={<DashboardRoute />} />
            <Route path="claims/new"             element={<NewClaim />} />
            {/* Adjudicator / Manager */}
            <Route path="claims/:id"             element={<ClaimDetail />} />
            <Route path="claims/:id/workflow"    element={<AdjusterWorkflow />} />
            {/* Claimant */}
            <Route path="claims/:id/view"        element={<ClaimantClaimView />} />
            <Route path="claims/:id/letter"      element={<DecisionLetter />} />
          </Route>
        </Routes>
        <ChatWidget />
      </BrowserRouter>
      </ToastProvider>
    </ThemeContext.Provider>
  )
}
