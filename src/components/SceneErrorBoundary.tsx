import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

interface SceneErrorBoundaryProps {
  children: ReactNode
  onError: (message: string) => void
}

interface SceneErrorBoundaryState {
  error: Error | null
}

export class SceneErrorBoundary extends Component<SceneErrorBoundaryProps, SceneErrorBoundaryState> {
  state: SceneErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): SceneErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, _info: ErrorInfo): void {
    this.props.onError(error.message)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="scene-fallback" role="alert">
          <AlertTriangle size={24} aria-hidden="true" />
          <h3>无法启动三维画布</h3>
          <p>请确认浏览器已启用 WebGL 与硬件加速，然后重新打开页面。</p>
        </div>
      )
    }

    return this.props.children
  }
}
