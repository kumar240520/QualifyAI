import React from 'react'
import { AlertCircle, RefreshCw, Home } from 'lucide-react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    // Log technical diagnostics internally for developers without exposing raw stacks to users
    console.error('[ErrorBoundary] Caught unhandled rendering exception:', error, errorInfo)
  }

  componentDidMount() {
    this.handleUnhandledRejection = (event) => {
      console.warn('[GlobalSafetyNet] Unhandled promise rejection caught:', event.reason)
      // Prevent crash if desirable, or let application error state handle it
    }

    this.handleGlobalError = (event) => {
      console.warn('[GlobalSafetyNet] Global script error caught:', event.message)
    }

    window.addEventListener('unhandledrejection', this.handleUnhandledRejection)
    window.addEventListener('error', this.handleGlobalError)
  }

  componentWillUnmount() {
    window.removeEventListener('unhandledrejection', this.handleUnhandledRejection)
    window.removeEventListener('error', this.handleGlobalError)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col items-center justify-center p-6 selection:bg-blue-600 selection:text-white">
          <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl p-8 text-center space-y-6 shadow-xl">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto">
              <AlertCircle className="w-7 h-7" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                Something went wrong
              </h2>
              <p className="text-xs text-slate-500 leading-relaxed">
                An unexpected condition occurred while loading this view. Your saved data is safe. Please try refreshing or return home.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reload</span>
              </button>

              <button
                onClick={() => {
                  window.location.href = '/'
                }}
                className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-sm cursor-pointer"
              >
                <Home className="w-3.5 h-3.5" />
                <span>Return Home</span>
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
