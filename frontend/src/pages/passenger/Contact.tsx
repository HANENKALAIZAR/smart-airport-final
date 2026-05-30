import React, { useState } from 'react';
import { Mail, CheckCircle2, AlertCircle } from 'lucide-react';
import { GlassCard } from '../../components/admin/AdminShell'; // Reusing for styling

export default function Contact() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    airport: 'TUN',
    subject: '',
    message: ''
  });
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const AIRPORTS = [
    { code: 'TUN', name: 'Tunis-Carthage (TUN)' },
    { code: 'MIR', name: 'Monastir (MIR)' },
    { code: 'DJE', name: 'Djerba-Zarzis (DJE)' },
    { code: 'NBE', name: 'Enfidha-Hammamet (NBE)' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('submitting');
    setErrorMessage('');

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/messages/public-feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (!res.ok) {
        throw new Error('Failed to submit feedback');
      }

      setStatus('success');
      setFormData({
        name: '',
        email: '',
        airport: 'TUN',
        subject: '',
        message: ''
      });
    } catch (err: any) {
      setStatus('error');
      setErrorMessage(err.message || 'An error occurred. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-[#0F172A] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <GlassCard className="p-8">
          <div className="text-center mb-8">
            <div className="mx-auto bg-primary/20 w-12 h-12 rounded-full flex items-center justify-center mb-4 border border-primary/30">
              <Mail className="text-primary" size={24} />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Contact Airport</h2>
            <p className="text-muted-foreground text-sm">
              Send feedback or inquiries directly to airport administration.
            </p>
          </div>

          {status === 'success' ? (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-6 text-center">
              <CheckCircle2 className="text-emerald-400 mx-auto mb-3" size={32} />
              <h3 className="text-emerald-400 font-semibold mb-2">Message Sent</h3>
              <p className="text-sm text-emerald-400/80 mb-4">
                Thank you for your feedback. We will get back to you shortly.
              </p>
              <button
                onClick={() => setStatus('idle')}
                className="text-sm text-white bg-surface-3 px-4 py-2 rounded-lg hover:bg-surface-4 transition-colors"
              >
                Send Another Message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {status === 'error' && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-center gap-2 text-red-400 text-sm">
                  <AlertCircle size={16} />
                  {errorMessage}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Full Name</label>
                <input
                  required
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-surface-1/50 border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Email Address</label>
                <input
                  required
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-surface-1/50 border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
                  placeholder="john@example.com"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Airport</label>
                <select
                  required
                  value={formData.airport}
                  onChange={e => setFormData({ ...formData, airport: e.target.value })}
                  className="w-full bg-surface-1/50 border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
                >
                  {AIRPORTS.map(a => (
                    <option key={a.code} value={a.code} className="bg-surface-1">
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Subject</label>
                <input
                  required
                  type="text"
                  value={formData.subject}
                  onChange={e => setFormData({ ...formData, subject: e.target.value })}
                  className="w-full bg-surface-1/50 border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
                  placeholder="How can we help?"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Message</label>
                <textarea
                  required
                  rows={4}
                  value={formData.message}
                  onChange={e => setFormData({ ...formData, message: e.target.value })}
                  className="w-full bg-surface-1/50 border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary resize-none"
                  placeholder="Your message here..."
                />
              </div>

              <button
                type="submit"
                disabled={status === 'submitting'}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50 mt-6"
              >
                {status === 'submitting' ? 'Sending...' : 'Send Message'}
              </button>
            </form>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
