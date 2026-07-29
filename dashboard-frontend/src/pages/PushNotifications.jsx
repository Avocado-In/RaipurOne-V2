import React, { useState, useEffect } from 'react';
import { Send, Users, Bell, AlertTriangle, Droplets, Zap, Activity, CheckCircle, XCircle, Clock } from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000';

const PushNotifications = () => {
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    category: 'alert',
    priority: 'medium',
    channels: {
      telegram: true,
      whatsapp: true,
      inApp: true,
    },
  });

  const [notificationHistory, setNotificationHistory] = useState([]);
  const [subscriberCount, setSubscriberCount] = useState({
    telegram: 0,
    whatsapp: 0,
    inApp: 0,
    total: 0,
  });
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Notification templates
  const templates = [
    {
      id: 'malaria',
      title: '🦟 Malaria Outbreak Alert',
      message: 'Health authorities have detected increased malaria cases in your area. Please take preventive measures and use mosquito nets.',
      category: 'health',
      priority: 'high',
      icon: Activity,
    },
    {
      id: 'water_cutoff',
      title: '💧 Water Supply Interruption',
      message: 'Water supply will be interrupted on [DATE] from [TIME] to [TIME] for maintenance work. Please store water accordingly.',
      category: 'utility',
      priority: 'high',
      icon: Droplets,
    },
    {
      id: 'electricity_cutoff',
      title: '⚡ Power Outage Notice',
      message: 'Scheduled power maintenance on [DATE] from [TIME] to [TIME] in [AREA]. Please plan accordingly.',
      category: 'utility',
      priority: 'medium',
      icon: Zap,
    },
    {
      id: 'civic_warning',
      title: '⚠️ Civic Warning',
      message: 'Important civic announcement: [DETAILS]. Please follow the guidelines issued by the municipal authorities.',
      category: 'alert',
      priority: 'medium',
      icon: AlertTriangle,
    },
    {
      id: 'disease_alert',
      title: '🏥 Disease Alert',
      message: 'Health advisory: Cases of [DISEASE] reported in [AREA]. Please maintain hygiene and consult a doctor if you experience symptoms.',
      category: 'health',
      priority: 'high',
      icon: Activity,
    },
  ];

  // Load notification history and subscriber count
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [historyRes, subscribersRes] = await Promise.all([
        axios.get(`${API_URL}/notifications/history`),
        axios.get(`${API_URL}/notifications/subscribers`),
      ]);

      setNotificationHistory(historyRes.data.notifications || []);
      setSubscriberCount(subscribersRes.data.subscribers || {
        telegram: 0,
        whatsapp: 0,
        inApp: 0,
        total: 0,
      });
    } catch (error) {
      console.error('Error loading data:', error);
      setErrorMessage('Failed to load notification data');
    } finally {
      setLoading(false);
    }
  };

  const handleTemplateSelect = (template) => {
    setFormData({
      ...formData,
      title: template.title,
      message: template.message,
      category: template.category,
      priority: template.priority,
    });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleChannelToggle = (channel) => {
    setFormData({
      ...formData,
      channels: {
        ...formData.channels,
        [channel]: !formData.channels[channel],
      },
    });
  };

  const handleSendNotification = async (e) => {
    e.preventDefault();
    
    if (!formData.title || !formData.message) {
      setErrorMessage('Please fill in title and message');
      return;
    }

    const selectedChannels = Object.keys(formData.channels).filter(
      (channel) => formData.channels[channel]
    );

    if (selectedChannels.length === 0) {
      setErrorMessage('Please select at least one notification channel');
      return;
    }

    setSending(true);
    setSuccessMessage('');
    setErrorMessage('');

    try {
      const response = await axios.post(`${API_URL}/notifications/send`, {
        title: formData.title,
        message: formData.message,
        category: formData.category,
        priority: formData.priority,
        channels: selectedChannels,
      });

      setSuccessMessage(
        `Notification sent successfully to ${response.data.sent_count} subscribers across ${selectedChannels.length} channel(s)!`
      );
      
      // Reset form
      setFormData({
        title: '',
        message: '',
        category: 'alert',
        priority: 'medium',
        channels: {
          telegram: true,
          whatsapp: true,
          inApp: true,
        },
      });

      // Reload history
      loadData();

    } catch (error) {
      console.error('Error sending notification:', error);
      setErrorMessage(
        error.response?.data?.message || 'Failed to send notification. Please try again.'
      );
    } finally {
      setSending(false);
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high':
        return 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400';
      case 'medium':
        return 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'low':
        return 'text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400';
      default:
        return 'text-gray-600 bg-gray-50 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'sent':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'pending':
        return <Clock className="w-5 h-5 text-yellow-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-black dark:text-white">
            Push Notifications
          </h2>
          <p className="text-black/60 dark:text-white/60 mt-1">
            Broadcast alerts and announcements to citizens
          </p>
        </div>
        <button
          onClick={loadData}
          className="px-4 py-2 rounded-lg bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Subscriber Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-6 rounded-xl bg-black dark:bg-white text-white dark:text-black">
          <div className="flex items-center justify-between">
            <Users className="w-8 h-8" />
            <span className="text-3xl font-bold">{subscriberCount.total}</span>
          </div>
          <p className="mt-2 text-sm opacity-80">Total Subscribers</p>
        </div>

        <div className="p-6 rounded-xl border-2 border-black/10 dark:border-white/10">
          <div className="flex items-center justify-between">
            <Bell className="w-6 h-6 text-black dark:text-white" />
            <span className="text-2xl font-bold text-black dark:text-white">
              {subscriberCount.inApp}
            </span>
          </div>
          <p className="mt-2 text-sm text-black/60 dark:text-white/60">In-App (FCM)</p>
        </div>

        <div className="p-6 rounded-xl border-2 border-black/10 dark:border-white/10">
          <div className="flex items-center justify-between">
            <svg className="w-6 h-6 text-black dark:text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295-.002 0-.003 0-.005 0l.213-3.053 5.56-5.023c.242-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.64-.203-.654-.64.135-.954l11.566-4.458c.538-.196 1.006.128.832.941z" />
            </svg>
            <span className="text-2xl font-bold text-black dark:text-white">
              {subscriberCount.telegram}
            </span>
          </div>
          <p className="mt-2 text-sm text-black/60 dark:text-white/60">Telegram</p>
        </div>

        <div className="p-6 rounded-xl border-2 border-black/10 dark:border-white/10">
          <div className="flex items-center justify-between">
            <svg className="w-6 h-6 text-black dark:text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
            </svg>
            <span className="text-2xl font-bold text-black dark:text-white">
              {subscriberCount.whatsapp}
            </span>
          </div>
          <p className="mt-2 text-sm text-black/60 dark:text-white/60">WhatsApp</p>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Send Notification Form */}
        <div className="space-y-6">
          <div className="p-6 rounded-xl border-2 border-black/10 dark:border-white/10">
            <h3 className="text-xl font-bold text-black dark:text-white mb-4">
              Send Notification
            </h3>

            {/* Templates */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-black dark:text-white mb-2">
                Quick Templates
              </label>
              <div className="grid grid-cols-1 gap-2">
                {templates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => handleTemplateSelect(template)}
                    className="flex items-center gap-3 p-3 rounded-lg border-2 border-black/10 dark:border-white/10 hover:border-black dark:hover:border-white transition-colors text-left"
                  >
                    <template.icon className="w-5 h-5 text-black dark:text-white" />
                    <span className="text-sm font-medium text-black dark:text-white">
                      {template.title.replace(/[🦟💧⚡⚠️🏥]/g, '')}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleSendNotification} className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-semibold text-black dark:text-white mb-2">
                  Notification Title *
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  placeholder="Enter notification title"
                  className="w-full px-4 py-3 rounded-lg border-2 border-black/10 dark:border-white/10 bg-transparent text-black dark:text-white placeholder:text-black/40 dark:placeholder:text-white/40 focus:border-black dark:focus:border-white outline-none transition-colors"
                  required
                />
              </div>

              {/* Message */}
              <div>
                <label className="block text-sm font-semibold text-black dark:text-white mb-2">
                  Message *
                </label>
                <textarea
                  name="message"
                  value={formData.message}
                  onChange={handleInputChange}
                  placeholder="Enter notification message"
                  rows={5}
                  className="w-full px-4 py-3 rounded-lg border-2 border-black/10 dark:border-white/10 bg-transparent text-black dark:text-white placeholder:text-black/40 dark:placeholder:text-white/40 focus:border-black dark:focus:border-white outline-none transition-colors resize-none"
                  required
                />
              </div>

              {/* Category & Priority */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-black dark:text-white mb-2">
                    Category
                  </label>
                  <select
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
                  <label className="block text-sm font-semibold text-black dark:text-white mb-2">
                    Priority
                  </label>
                  <select
                    name="priority"
                    value={formData.priority}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 rounded-lg border-2 border-black/10 dark:border-white/10 bg-white dark:bg-black text-black dark:text-white focus:border-black dark:focus:border-white outline-none transition-colors"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>

              {/* Channels */}
              <div>
                <label className="block text-sm font-semibold text-black dark:text-white mb-3">
                  Notification Channels
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 p-3 rounded-lg border-2 border-black/10 dark:border-white/10 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.channels.inApp}
                      onChange={() => handleChannelToggle('inApp')}
                      className="w-5 h-5 rounded border-2 border-black/20 dark:border-white/20"
                    />
                    <Bell className="w-5 h-5 text-black dark:text-white" />
                    <span className="text-sm font-medium text-black dark:text-white">
                      In-App Push (FCM)
                    </span>
                  </label>

                  <label className="flex items-center gap-3 p-3 rounded-lg border-2 border-black/10 dark:border-white/10 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.channels.telegram}
                      onChange={() => handleChannelToggle('telegram')}
                      className="w-5 h-5 rounded border-2 border-black/20 dark:border-white/20"
                    />
                    <svg className="w-5 h-5 text-black dark:text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295-.002 0-.003 0-.005 0l.213-3.053 5.56-5.023c.242-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.64-.203-.654-.64.135-.954l11.566-4.458c.538-.196 1.006.128.832.941z" />
                    </svg>
                    <span className="text-sm font-medium text-black dark:text-white">
                      Telegram
                    </span>
                  </label>

                  <label className="flex items-center gap-3 p-3 rounded-lg border-2 border-black/10 dark:border-white/10 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.channels.whatsapp}
                      onChange={() => handleChannelToggle('whatsapp')}
                      className="w-5 h-5 rounded border-2 border-black/20 dark:border-white/20"
                    />
                    <svg className="w-5 h-5 text-black dark:text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                    </svg>
                    <span className="text-sm font-medium text-black dark:text-white">
                      WhatsApp
                    </span>
                  </label>
                </div>
              </div>

              {/* Success/Error Messages */}
              {successMessage && (
                <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border-2 border-green-500 text-green-700 dark:text-green-400 text-sm">
                  {successMessage}
                </div>
              )}

              {errorMessage && (
                <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border-2 border-red-500 text-red-700 dark:text-red-400 text-sm">
                  {errorMessage}
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={sending}
                className="w-full py-4 rounded-lg bg-black dark:bg-white text-white dark:text-black font-semibold hover:scale-[1.02] active:scale-[0.98] transition-transform disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {sending ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/20 dark:border-black/20 border-t-white dark:border-t-black rounded-full animate-spin"></div>
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    Send Notification
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Notification History */}
        <div className="space-y-4">
          <div className="p-6 rounded-xl border-2 border-black/10 dark:border-white/10">
            <h3 className="text-xl font-bold text-black dark:text-white mb-4">
              Recent Notifications
            </h3>

            <div className="space-y-3 max-h-[800px] overflow-y-auto">
              {loading ? (
                <div className="text-center py-8">
                  <div className="w-8 h-8 border-4 border-black/20 dark:border-white/20 border-t-black dark:border-t-white rounded-full animate-spin mx-auto"></div>
                  <p className="text-sm text-black/60 dark:text-white/60 mt-3">Loading...</p>
                </div>
              ) : notificationHistory.length === 0 ? (
                <div className="text-center py-12">
                  <Bell className="w-12 h-12 text-black/20 dark:text-white/20 mx-auto mb-3" />
                  <p className="text-black/60 dark:text-white/60">No notifications sent yet</p>
                </div>
              ) : (
                notificationHistory.map((notification) => (
                  <div
                    key={notification.id}
                    className="p-4 rounded-lg border-2 border-black/10 dark:border-white/10 hover:border-black/20 dark:hover:border-white/20 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-semibold text-black dark:text-white">
                        {notification.title}
                      </h4>
                      {getStatusIcon(notification.status)}
                    </div>

                    <p className="text-sm text-black/60 dark:text-white/60 mb-3 line-clamp-2">
                      {notification.message}
                    </p>

                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${getPriorityColor(notification.priority)}`}>
                        {notification.priority}
                      </span>
                      <span className="px-2 py-1 rounded text-xs font-semibold bg-black/10 dark:bg-white/10 text-black dark:text-white">
                        {notification.category}
                      </span>
                      <span className="text-xs text-black/40 dark:text-white/40">
                        {new Date(notification.created_at).toLocaleString()}
                      </span>
                    </div>

                    {notification.sent_count > 0 && (
                      <div className="mt-3 pt-3 border-t border-black/10 dark:border-white/10">
                        <div className="flex items-center gap-2 text-xs text-black/60 dark:text-white/60">
                          <Users className="w-4 h-4" />
                          Sent to {notification.sent_count} subscribers via{' '}
                          {notification.channels?.join(', ') || 'multiple channels'}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PushNotifications;
