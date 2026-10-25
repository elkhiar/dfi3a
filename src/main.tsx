import { StrictMode } from 'react'
import { App as CapacitorApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider.tsx'
import './index.css'
import App from './App.tsx'
import { getNativeRoute } from './lib/platform.ts'

function openNativeUrl(url?: string) {
  if (!url) return
  const route = getNativeRoute(url)
  if (!route) return
  window.history.replaceState({}, '', route)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

if (Capacitor.isNativePlatform()) {
  void CapacitorApp.getLaunchUrl().then((launch) => openNativeUrl(launch?.url))
  void CapacitorApp.addListener('appUrlOpen', ({ url }) => openNativeUrl(url))
}

if (import.meta.env.PROD && !Capacitor.isNativePlatform() && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js')
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
