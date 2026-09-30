import { AlertTriangle, RotateCcw } from "lucide-react";
import { Component, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { hasError: boolean; error: Error | null };

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };
  static getDerivedStateFromError(error: Error): State { return { hasError: true, error }; }
  render() {
    if (!this.state.hasError) return this.props.children;
    return <div className="center-screen"><AlertTriangle size={42} /><h2>Ocorreu um erro ao abrir sua agenda</h2><p>{this.state.error?.message}</p><button className="primary-button" onClick={() => window.location.reload()}><RotateCcw size={16} /> tentar novamente</button></div>;
  }
}
