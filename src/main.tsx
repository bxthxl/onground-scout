import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
// Snaplistings-style type system: Inter for everything, Fragment Mono for the
// small uppercase eyebrow labels. Self-hosted via Fontsource so it works offline.
import '@fontsource-variable/inter/wght.css'
import '@fontsource/fragment-mono/400.css'
import './index.css'
import App from './App.tsx'
import Admin from './Admin.tsx'

// Hidden owner route: open the site with #admin (e.g. https://yoursite.com/#admin)
// to reach the applications dashboard. Everything else renders the public site.
function Root() {
  const [isAdmin, setIsAdmin] = useState(window.location.hash === '#admin')
  useEffect(() => {
    const onHashChange = () => setIsAdmin(window.location.hash === '#admin')
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])
  return isAdmin ? <Admin /> : <App />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
