import React from 'react';

type Props = { children: React.ReactNode };
type State = { hasError: boolean; error?: Error | null; info?: any };

class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: any) {
    // Puedes integrar aquí un servicio de logging (Sentry, LogRocket, etc.)
    // Por ahora lo registramos en consola para facilitar depuración local
    console.error('Unhandled error caught by ErrorBoundary:', error, info);
    this.setState({ info });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-red-50 border border-red-200 rounded text-red-700">
          <h2 className="font-bold text-lg mb-2">Se produjo un error en la aplicación</h2>
          <p className="text-sm mb-2">Por favor recarga la página o contacta con soporte.</p>
          <details className="text-xs whitespace-pre-wrap bg-white/5 p-2 rounded">
            {String(this.state.error?.message)}
            {this.state.info?.componentStack ? '\n' + this.state.info.componentStack : null}
          </details>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
