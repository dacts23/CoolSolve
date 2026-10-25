import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
// Self-hosted coding fonts (Fontsource): the editor offers these by name,
// so they must resolve on any machine, not just ones with them installed.
// 400 = regular, 700 = bold keywords, 400-italic = italic comments.
import '@fontsource/cascadia-code/400.css'
import '@fontsource/cascadia-code/400-italic.css'
import '@fontsource/cascadia-code/700.css'
import '@fontsource/fira-code/400.css'
import '@fontsource/fira-code/700.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/400-italic.css'
import '@fontsource/jetbrains-mono/700.css'
import './App.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
