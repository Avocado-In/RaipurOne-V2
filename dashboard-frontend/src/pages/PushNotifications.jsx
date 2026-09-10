import React, { useCallback, useEffect, useState } from 'react';
import { Send, Users, AlertTriangle, Droplets, Zap, Activity, CheckCircle, XCircle } from 'lucide-react';
import { broadcastAPI } from '../api';

// Civic broadcasts to citizens.
//
// The audience is not a mailing list: it is every person who has filed a complaint
// through the R1 Telegram bot. They opened that conversation themselves, which is both
// why we can reach them and the only reason it is reasonable to.
//
// This screen used to offer FCM and WhatsApp next to Telegram. Neither had anything
// behind it, so "sent to 3 channels" meant one channel delivered and two silently did
// nothing. Telegram is what this system can actually deliver on, so it is what is on
// offer here.

const TELEGRAM_ICON = (
  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295-.002 0-.003 0-.005 0l.213-3.053 5.56-5.023c.242-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.64-.203-.654-.64.135-.954l11.566-4.458c.538-.196 1.006.128.832.941z" />
  </svg>
);

const TEMPLATES = [
  {
    id: 'malaria',
    title: '🦟 Malaria Outbreak Alert',
    message:
      'Health authorities have detected increased malaria cases in your area. Please take preventive measures and use mosquito nets.',
    category: 'health',
    priority: 'high',
    icon: Activity,
  },
  {
    id: 'water',
    title: '💧 Water Supply Interruption',
    message:
      'Water supply will be interrupted in your area on [DATE] from [TIME] for maintenance work. Please store water in advance.',
    category: 'utility',
    priority: 'medium',
    icon: Droplets,
  },
  {
    id: 'power',
    title: '⚡ Power Outage Notice',
    message:
      'Scheduled power maintenance in your area on [DATE] from [TIME]. We apologise for the inconvenience.',
    category: 'utility',
    priority: 'medium',
    icon: Zap,
  },
  {
    id: 'civic',
    title: '⚠️ Civic Warning',
    message:
      'Important civic announcement: [DETAILS]. Please follow the guidelines issued by the municipal authorities.',
    category: 'alert',
    priority: 'medium',
    icon: AlertTriangle,
  },
  {
    id: 'disease_alert',
    title: '🏥 Disease Alert',
    message:
      'Health advisory: Cases of [DISEASE] reported in [AREA]. Please maintain hygiene and consult a doctor if you experience symptoms.',
    category: 'health',
    priority: 'high',
    icon: Activity,
  },
];

const EMPTY_FORM = { title: '', message: '', category: 'alert', priority: 'medium' };

const errorText = (error, fallback) =>
  error?.response?.data?.detail || error?.response?.data?.message || error?.message || fallback;

const when = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString();
};

const priorityClass = (priority) =>
  ({
    critical: 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400',
    high: 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400',
    medium: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 dark:text-yellow-400',
    low: 'text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400',
  })[priority] || 'text-gray-600 bg-gray-50 dark:bg-gray-900/20 dark:text-gray-400';

const PushNotifications = () => {
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [history, setHistory] = useState([]);
  const [reachable, setReachable] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      const [subscribers, past] = await Promise.all([
        broadcastAPI.getSubscribers(),
        broadcastAPI.getHistory(),
      ]);
      setReachable(subscribers.data?.subscribers?.telegram ?? 0);
      setHistory(past.data?.notifications || []);
    } catch (error) {
      setErrorMessage(errorText(error, 'Could not load broadcast data.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const applyTemplate = (template) =>
    setFormData({
      title: template.title,
      message: template.message,
      category: template.category,
      priority: template.priority,
    });

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setFormData((previous) => ({ ...previous, [name]: value }));
  };

  const handleSend = async (event) => {
    event.preventDefault();
    setSuccessMessage('');
    setErrorMessage('');

    if (!formData.title.trim() || !formData.message.trim()) {
      setErrorMessage('Title and message are both required.');
      return;
    }
    if (reachable === 0) {
      setErrorMessage('Nobody has used the Telegram bot yet, so there is no one to send to.');
      return;
    }

    // These messages land in real people's chats and cannot be recalled.
    const confirmed = window.confirm(
      `Send "${formData.title.trim()}" to ${reachable} citizen${reachable === 1 ? '' : 's'} on Telegram?\n\n` +
        'This cannot be undone.'
    );
    if (!confirmed) return;

    setSending(true);
    try {
      const response = await broadcastAPI.send({
        title: formData.title.trim(),
        message: formData.message.trim(),
        category: formData.category,
        priority: formData.priority,
      });
      const { sent_count: sent, recipients, failed } = response.data;
      setSuccessMessage(
        failed
          ? `Delivered to ${sent} of ${recipients} citizens. ${failed} could not be reached — they have most likely blocked the bot.`
          : `Delivered to all ${sent} citizens.`
      );
      setFormData(EMPTY_FORM);
      loadData();
    } catch (error) {
      setErrorMessage(errorText(error, 'Could not send the broadcast.'));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-3xl font-bold text-black dark:text-white">Push Notifications</h2>
          <p className="text-black/60 dark:text-white/60 mt-1">
            Broadcast alerts and announcements to citizens on Telegram
          </p>
        </div>
        <button
          onClick={loadData}
          className="px-4 py-2 rounded-lg bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors text-black dark:text-white"
        >
          Refresh
        </button>
      </div>

      {/* Audience */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-6 rounded-xl bg-black dark:bg-white text-white dark:text-black">
          <div className="flex items-center justify-between">
            <Users className="w-8 h-8" />
            <span className="text-3xl font-bold">{loading ? '—' : reachable}</span>
          </div>
          <p className="mt-2 text-sm opacity-80">Citizens reachable</p>
        </div>

        <div className="md:col-span-2 p-6 rounded-xl border-2 border-black/10 dark:border-white/10">
          <div className="flex items-center gap-3 text-black dark:text-white">
            {TELEGRAM_ICON}
            <span className="font-semibold">Telegram</span>
          </div>
          <p className="mt-2 text-sm text-black/60 dark:text-white/60">
            Everyone who has filed a complaint through the R1 bot. They started that chat
            themselves, which is the only reason we can message them — so there is no
            separate subscriber list to manage.
          </p>
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-lg border-2 border-red-500 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200">
          {errorMessage}
        </div>
      )}
      {successMessage && (
        <div className="p-4 rounded-lg border-2 border-green-500 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200">
          {successMessage}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Compose */}
        <div className="p-6 rounded-xl border-2 border-black/10 dark:border-white/10">
          <h3 className="text-xl font-bold text-black dark:text-white mb-4">Send Notification</h3>

          <div className="mb-6">
            <span className="block text-sm font-semibold text-black dark:text-white mb-2">
              Quick Templates
            </span>
            <div className="grid grid-cols-1 gap-2">
              {TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => applyTemplate(template)}
                  className="flex items-center gap-3 p-3 rounded-lg border-2 border-black/10 dark:border-white/10 hover:border-black dark:hover:border-white transition-colors text-left"
                >
                  <template.icon className="w-5 h-5 text-black dark:text-white shrink-0" />
                  <span className="text-sm font-medium text-black dark:text-white">
                    {template.title.replace(/[🦟💧⚡⚠️🏥]/g, '').trim()}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSend} className="space-y-4">
            <div>
              <label
                htmlFor="broadcast-title"
                className="block text-sm font-semibold text-black dark:text-white mb-2"
              >
                Notification Title *
              </label>
              <input
                id="broadcast-title"
                type="text"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                placeholder="Enter notification title"
                maxLength={200}
                className="w-full px-4 py-3 rounded-lg border-2 border-black/10 dark:border-white/10 bg-transparent text-black dark:text-white placeholder:text-black/40 dark:placeholder:text-white/40 focus:border-black dark:focus:border-white outline-none transition-colors"
                required
              />
            </div>

            <div>
              <label
                htmlFor="broadcast-message"
                className="block text-sm font-semibold text-black dark:text-white mb-2"
              >
                Message *
              </label>
              <textarea
                id="broadcast-message"
                name="message"
                value={formData.message}
                onChange={handleInputChange}
                placeholder="Enter notification message"
                rows={5}
                maxLength={3000}
                className="w-full px-4 py-3 rounded-lg border-2 border-black/10 dark:border-white/10 bg-transparent text-black dark:text-white placeholder:text-black/40 dark:placeholder:text-white/40 focus:border-black dark:focus:border-white outline-none transition-colors resize-none"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="broadcast-category"
                  className="block text-sm font-semibold text-black dark:text-white mb-2"
                >
                  Category
                </label>
                <select
                  id="broadcast-category"
                  name="category"
                  value={formData.category}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 rounded-lg border-2 border-black/10 dark:border-white/10 bg-white dark:bg-black text-black dark:text-white focus:border-black dark:focus:border-white outline-none transition-colors"
                >
                  <option value="alert">Alert</option>
                  <option value="health">Health</option>
                  <option value="utility">Utility</option>
                  <option value="civic">Civic</option>
                  <option value="emergency">Emergency</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="broadcast-priority"
                  className="block text-sm font-semibold text-black dark:text-white mb-2"
                >
                  Priority
                </label>
                <select
                  id="broadcast-priority"
                  name="priority"
                  value={formData.priority}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 rounded-lg border-2 border-black/10 dark:border-white/10 bg-white dark:bg-black text-black dark:text-white focus:border-black dark:focus:border-white outline-none transition-colors"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={sending || loading || reachable === 0}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-black dark:bg-white text-white dark:text-black font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Send className="w-5 h-5" />
              {sending
                ? 'Sending…'
                : reachable === 0
                  ? 'No one to send to yet'
                  : `Send to ${reachable} citizen${reachable === 1 ? '' : 's'}`}
            </button>
            <p className="text-xs text-black/50 dark:text-white/50 text-center">
              Messages land in people&apos;s chats immediately and cannot be recalled.
            </p>
          </form>
        </div>

        {/* History */}
        <div className="p-6 rounded-xl border-2 border-black/10 dark:border-white/10">
          <h3 className="text-xl font-bold text-black dark:text-white mb-4">Recent Broadcasts</h3>

          {loading ? (
            <p className="text-sm text-black/50 dark:text-white/50">Loading…</p>
          ) : history.length === 0 ? (
            <p className="text-sm text-black/50 dark:text-white/50">
              Nothing has been broadcast yet.
            </p>
          ) : (
            <div className="space-y-3 max-h-[640px] overflow-y-auto">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-lg border-2 border-black/10 dark:border-white/10"
                >
                  <div className="flex items-start justify-between gap-3 mb-1">
                    <p className="font-semibold text-black dark:text-white">{item.title}</p>
                    <span
                      className={`shrink-0 text-xs px-2 py-1 rounded ${priorityClass(item.priority)}`}
                    >
                      {item.priority}
                    </span>
                  </div>
                  <p className="text-sm text-black/70 dark:text-white/70 mb-3">{item.message}</p>
                  <div className="flex items-center gap-4 text-xs text-black/50 dark:text-white/50 flex-wrap">
                    <span className="flex items-center gap-1">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      {item.delivered} delivered
                    </span>
                    {item.failed > 0 && (
                      <span className="flex items-center gap-1">
                        <XCircle className="w-4 h-4 text-red-500" />
                        {item.failed} failed
                      </span>
                    )}
                    <span>{when(item.sent_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PushNotifications;
