/**
 * ErrorBoundary — Global React error boundary
 * ============================================
 * Catches rendering crashes and undefined-access errors that
 * would otherwise produce a blank white screen in production.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <YourApp />
 *   </ErrorBoundary>
 *
 *   // With custom fallback:
 *   <ErrorBoundary fallback={<MyCustomError />}>
 *     <YourApp />
 *   </ErrorBoundary>
 */
import { Component } from 'react';

export default class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, info) {
        // Log to console in dev; in prod this would go to Sentry / LogRocket
        console.error('[ErrorBoundary] Caught rendering error:', error, info?.componentStack);
    }

    handleReset() {
        this.setState({ hasError: false, error: null });
    }

    render() {
        if (!this.state.hasError) return this.props.children;

        // Use custom fallback if provided
        if (this.props.fallback) return this.props.fallback;

        const isDev = import.meta.env?.VITE_APP_ENV !== 'prod';

        return (
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#0f172a',
                padding: '2rem',
            }}>
                <div style={{
                    maxWidth: 480,
                    textAlign: 'center',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(239,68,68,0.25)',
                    borderRadius: 16,
                    padding: '2.5rem 2rem',
                }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>⚠️</div>
                    <h1 style={{
                        color: '#F1F5F9',
                        fontSize: '1.25rem',
                        fontWeight: 700,
                        marginBottom: '0.75rem',
                    }}>
                        Something went wrong
                    </h1>
                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                        An unexpected error occurred. Please try refreshing the page.
                    </p>

                    {isDev && this.state.error && (
                        <pre style={{
                            textAlign: 'left',
                            background: 'rgba(0,0,0,0.4)',
                            borderRadius: 8,
                            padding: '0.75rem',
                            fontSize: '0.72rem',
                            color: '#FCA5A5',
                            overflowX: 'auto',
                            marginBottom: '1.5rem',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                        }}>
                            {this.state.error?.message}
                        </pre>
                    )}

                    <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                        <button
                            onClick={() => this.handleReset()}
                            style={{
                                padding: '8px 20px',
                                borderRadius: 8,
                                border: '1px solid rgba(255,255,255,0.15)',
                                background: 'rgba(255,255,255,0.07)',
                                color: '#E2E8F0',
                                cursor: 'pointer',
                                fontSize: '0.875rem',
                            }}
                        >
                            Try Again
                        </button>
                        <button
                            onClick={() => window.location.reload()}
                            style={{
                                padding: '8px 20px',
                                borderRadius: 8,
                                border: 'none',
                                background: '#3b82f6',
                                color: '#fff',
                                cursor: 'pointer',
                                fontSize: '0.875rem',
                            }}
                        >
                            Reload Page
                        </button>
                    </div>
                </div>
            </div>
        );
    }
}
