import { Component, StrictMode, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: unknown) {
    console.error('[CRASH]', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, background: '#0a0e1c', color: '#f0f2f5', fontFamily: 'monospace', fontSize: 12, minHeight: '100vh' }}>
          <h1 style={{ color: '#E10600', fontSize: 16 }}>RUNTIME ERROR — app unmounted</h1>
          <pre style={{ whiteSpace: 'pre-wrap', color: '#EDB40B', marginTop: 12 }}>
            {this.state.error.message}
          </pre>
          <pre style={{ whiteSpace: 'pre-wrap', color: '#8b909e', marginTop: 8 }}>
            {this.state.error.stack}
          </pre>
        </div>
      )
    }
    return this.props.children
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)