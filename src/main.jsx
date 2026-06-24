import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

// Reset CSS mínimo
const style = document.createElement('style')
style.textContent = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #F7F9FC; color: #1A2B4A; -webkit-font-smoothing: antialiased; }
  input, select, button, textarea { font-family: inherit; }
  a { text-decoration: none; }
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #E5E7EB; border-radius: 3px; }
  ::-webkit-scrollbar-thumb:hover { background: #D1D5DB; }
`
document.head.appendChild(style)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)
