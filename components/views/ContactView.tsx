import React, { useEffect, useState } from 'react';
import { useAppContext } from '../../contexts/FirebaseAppContext';
import Input from '../ui/Input';
import Button from '../ui/Button';
import { CheckCircleIcon } from '../icons';

const WEB3FORMS_URL = 'https://api.web3forms.com/submit';
const ACCESS_KEY = 'dbac2710-a749-42ae-8ee6-1fcf1f70fb53';

export interface ContactViewProps {
  initialEmail?: string;
  initialMessage?: string;
  supportPrompted?: boolean; // when navigated via support prompt
  contextMeta?: {
    screen?: string;
    feature?: string;
    errorCode?: string;
    errorMessage?: string;
    extra?: any;
  };
}

const ContactView: React.FC<ContactViewProps> = ({ initialEmail, initialMessage, supportPrompted = false, contextMeta }) => {
  const { showToast, user } = useAppContext();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<{ name?: string; email?: string; message?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState<{success: boolean; message: string} | null>(null);

  // Pre-fill email and message: prefer props, fallback to authenticated user's email
  useEffect(() => {
    const defaultEmail = (initialEmail || user?.email || '').trim();
    if (defaultEmail) setEmail(defaultEmail);
    if (initialMessage) setMessage(initialMessage);
  }, [initialEmail, initialMessage, user?.email]);

  const validate = () => {
    const e: { name?: string; email?: string; message?: string } = {};
    if (!name.trim()) e.name = 'Please enter your name';
    if (!email.trim()) {
      e.email = 'Please enter your email';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(email.trim())) {
      e.email = 'Please enter a valid email address';
    }
    const msg = message.trim();
    if (!msg) e.message = 'Please enter a message';
    else if (msg.length < 10) e.message = 'Please provide a few more details (10+ characters)';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      // First attempt: JSON API (recommended by Web3Forms)
      const payload = {
        access_key: ACCESS_KEY,
        name: name.trim(),
        email: email.trim(),
        message: message.trim(),
        subject: 'SAT Mobile Contact',
        from_name: name.trim(),
        replyto: email.trim(),
        botcheck: ''
      } as const;

      let response = await fetch(WEB3FORMS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify(payload)
      });

      let result: any = null;
      try { result = await response.json(); } catch {}

      // If JSON path fails with a 4xx, try a FormData fallback (some setups prefer it)
      if (!(response.ok && result?.success)) {
        const fd = new FormData();
        fd.append('access_key', ACCESS_KEY);
        fd.append('name', name.trim());
        fd.append('email', email.trim());
        fd.append('message', message.trim());
        fd.append('subject', 'SAT Mobile Contact');
        fd.append('from_name', name.trim());
        fd.append('replyto', email.trim());
        fd.append('botcheck', '');

        response = await fetch(WEB3FORMS_URL, { method: 'POST', body: fd });
        try { result = await response.json(); } catch {}
      }

      if (response.ok && result?.success) {
        showToast('success', 'Message sent', 'Thanks for contacting us! We will get back to you soon.');
        setSent({ success: true, message: 'Your message was sent successfully.' });
        setName('');
        setEmail('');
        setMessage('');
        setErrors({});
      } else {
        const message = (result && (result.message || result.error)) || `HTTP ${response.status}: Failed to send`;
        throw new Error(message);
      }
    } catch (err: any) {
      showToast('error', 'Failed to send', err?.message || 'Please try again later.');
    } finally {
      setSubmitting(false);
    }
  };

  if (sent?.success) {
    return (
      <div className="max-w-md mx-auto text-center p-6">
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center shadow">
            <CheckCircleIcon className="w-9 h-9 text-green-600" />
          </div>
        </div>
        <h3 className="text-2xl font-bold text-gray-800 mb-2">Thank you!</h3>
        <p className="text-gray-600 mb-6">{sent.message} We’ll get back to you shortly.</p>
        <Button onClick={() => { try { (window as any).closeModal?.(); } catch {} }}>Close</Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="glass rounded-2xl p-6 sm:p-8 shadow-xl border border-gray-200/60 dark:border-dark-600/60 bg-white/70 dark:bg-dark-800/70">
        <div className="mb-6">
          <div className="flex items-start justify-between gap-4">
            <div className="text-center mx-auto">
              <h2 className="text-2xl font-extrabold text-gray-800">Contact Support</h2>
              <p className="text-sm text-gray-600 dark:text-dark-300 mt-1">Have a question or need assistance? Send us a message and we’ll reply via email.</p>
            </div>
            {supportPrompted && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  // Re-compose a helpful message template using contextMeta
                  const contextLines: string[] = [];
                  if (contextMeta?.screen) contextLines.push(`Screen: ${contextMeta.screen}`);
                  if (contextMeta?.feature) contextLines.push(`Feature: ${contextMeta.feature}`);
                  if (contextMeta?.errorCode) contextLines.push(`Error Code: ${contextMeta.errorCode}`);
                  if (contextMeta?.errorMessage) contextLines.push(`Error: ${contextMeta.errorMessage}`);
                  const body = `Hi Support,\n\nI encountered an issue${contextMeta?.feature ? ` with ${contextMeta.feature}` : ''}.${contextLines.length ? `\n\nContext:\n- ${contextLines.join('\n- ')}` : ''}\n\nPlease assist. Thank you.`;
                  if (!message) setMessage(body);
                }}
              >
                Use Context
              </Button>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <Input
                name="name"
                placeholder="Your name"
                value={name}
                onChange={setName}
                error={errors.name}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <Input
                name="email"
                type="email"
                placeholder="email@example.com"
                value={email}
                onChange={(val) => setEmail(val)}
                error={errors.email}
                required
              />
            </div>

            <div>
              <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">Message</label>
              <textarea
                id="message"
                name="message"
                className={`w-full py-3 px-3 border ${errors.message ? 'border-red-500' : 'border-gray-300'} rounded-xl shadow-sm focus:outline-none focus:ring-2 ${errors.message ? 'focus:ring-red-500' : 'focus:ring-blue-500'} focus:border-transparent transition-colors text-base bg-white text-gray-900 placeholder-gray-500 min-h-[120px]`}
                placeholder="Enter your message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
              />
              {errors.message && <p className="mt-1 text-xs text-red-600">{errors.message}</p>}
            </div>

            <div className="pt-2">
              <Button type="submit" variant="primary" size="lg" loading={submitting} className="w-full">
                {submitting ? 'Sending…' : 'Send Message'}
              </Button>
            </div>
          </div>
        </form>
      </div>

      <div className="mt-6 text-xs text-gray-500 text-center">
        Powered by Web3Forms
      </div>
    </div>
  );
};

export default ContactView;

