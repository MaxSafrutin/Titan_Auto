import React from 'react'
import ReactDOM from 'react-dom/client'
import Workspace from './Workspace'
import './styles.css'
import './deal-files.css'

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><Workspace /></React.StrictMode>)

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => registrations.forEach(registration => registration.unregister()))
}
if ('caches' in window) caches.keys().then(keys => keys.forEach(key => caches.delete(key)))
