/**
 * ErrorBoundary — Passenger app global error boundary
 */
import { Component, ReactNode } from 'react';

interface Props { children: ReactNode; fallback?: ReactNode; }
interface State { hasError: boolean; error: Error | null; }

export default class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: { componentStack: string }) {
        console.error('[ErrorBoundary]', error, info.componentStack);
    }

    render() {
        if (!this.state.hasError) return this.props.children;
        if (this.props.fallback) return this.props.fallback;

        const isDev = import.meta.env?.VITE_APP_ENV !== 'prod';

        return (
            <div style={{
                minHeight: '100vh', display: 'flex', alignItems: 'center',
                justifyContent: 'center', background: '#0a0f1e', padding: '2rem',
            }}>
                <div style={{
                    maxWidth: 480, textAlign: 'center',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(239,68,68,0.2)',
                    borderRadius: 16, padding: '2.5rem 2rem',
                }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>✈️ ⚠️</div>
                    <h1 style={{ color: '#F1F5F9', fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem' }}>
                        Something went wrong
                    </h1>
                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                        We encountered an unexpected error. Please refresh the page.
                    </p>
                    {isDev && this.state.error && (
                        <pre style={{
                            textAlign: 'left', background: 'rgba(0,0,0,0.4)', borderRadius: 8,
                            padding: '0.75rem', fontSize: '0.72rem', color: '#FCA5A5',
                            overflowX: 'auto', marginBottom: '1.5rem',
                            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                        }}>
                            {this.state.error?.message}
                        </pre>
                    )}
                    <button
                        onClick={() => window.location.reload()}
                        style={{
                            padding: '10px 28px', borderRadius: 8, border: 'none',
                            background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)',
                            color: '#fff', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600,
                        }}
                    >
                        Reload Page
                    </button>
                </div>
            </div>
        );
    }
}
