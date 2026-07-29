import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import io from 'socket.io-client';

const EnhancedNotificationBell = () => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const [socket, setSocket] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    // This backend has no Socket.IO server. Enable only when one is explicitly configured.
    const socketUrl = process.env.REACT_APP_SOCKET_URL;
    if (!socketUrl) return;
    const newSocket = io(socketUrl);
    
    newSocket.on('connect', () => {
      console.log('Notification socket connected');
    });

    // Listen for new complaint notifications
    newSocket.on('new_complaint', (data) => {
      addNotification({
        id: Date.now(),
        type: 'complaint',
        title: 'New Complaint Received',
        message: data.query || 'A new complaint has been submitted',
        ticketId: data.ticketId,
        timestamp: new Date(),
        icon: '📝',
        color: 'bg-red-500',
      });
    });

    // Listen for worker completion notifications
    newSocket.on('work_completed', (data) => {
      addNotification({
        id: Date.now(),
        type: 'completion',
        title: 'Task Completed',
        message: `Worker ${data.workerName} has completed the task`,
        ticketId: data.ticketId,
        timestamp: new Date(),
        icon: '✅',
        color: 'bg-green-500',
      });
    });

    // Listen for worker assignment confirmations
    newSocket.on('worker_assigned', (data) => {
      addNotification({
        id: Date.now(),
        type: 'assignment',
        title: 'Worker Assigned',
        message: `Task assigned to ${data.workerName}`,
        ticketId: data.ticketId,
        timestamp: new Date(),
        icon: '👷',
        color: 'bg-blue-500',
      });
    });

    // Listen for ticket updates
    newSocket.on('ticket_updated', (data) => {
      addNotification({
        id: Date.now(),
        type: 'update',
        title: 'Ticket Updated',
        message: data.message || 'A ticket has been updated',
        ticketId: data.ticketId,
        timestamp: new Date(),
        icon: '🔔',
        color: 'bg-blue-500',
      });
    });

    setSocket(newSocket);

    // Load existing notifications from localStorage
    const savedNotifications = localStorage.getItem('notifications');
    if (savedNotifications) {
      const parsed = JSON.parse(savedNotifications);
      setNotifications(parsed);
      setUnreadCount(parsed.filter((n) => !n.read).length);
    }

    return () => {
      newSocket.disconnect();
    };
  }, []);

  useEffect(() => {
    // Save notifications to localStorage whenever they change
    localStorage.setItem('notifications', JSON.stringify(notifications));
  }, [notifications]);

  const addNotification = (notification) => {
    setNotifications((prev) => [notification, ...prev].slice(0, 50)); // Keep last 50
    setUnreadCount((prev) => prev + 1);

    // Play notification sound
    playNotificationSound();

    // Show browser notification if permitted
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.message,
        icon: '/logo192.png',
      });
    }
  };

  const playNotificationSound = () => {
    const audio = new Audio('/notification.mp3');
    audio.volume = 0.3;
    audio.play().catch((err) => console.log('Could not play sound:', err));
  };

  const requestNotificationPermission = async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  };

  useEffect(() => {
    requestNotificationPermission();
  }, []);

  const handleNotificationClick = (notification) => {
    // Mark as read
    setNotifications((prev) =>
      prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
    setShowDropdown(false);

    // Navigate to ticket if applicable
    if (notification.ticketId) {
      navigate(`/tickets/${notification.ticketId}`);
    }
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const clearAll = () => {
    setNotifications([]);
    setUnreadCount(0);
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMs = now - date;
    const diffInMins = Math.floor(diffInMs / 60000);
    const diffInHours = Math.floor(diffInMs / 3600000);
    const diffInDays = Math.floor(diffInMs / 86400000);

    if (diffInMins < 1) return 'Just now';
    if (diffInMins < 60) return `${diffInMins}m ago`;
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInDays < 7) return `${diffInDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="relative">
      {/* Bell Icon Button */}
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="relative p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
        aria-label="Notifications"
      >
        <svg
          className="w-6 h-6 text-black dark:text-white"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {/* Unread Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {showDropdown && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowDropdown(false)}
          />

          {/* Notification Panel */}
          <div className="absolute right-0 mt-2 w-96 bg-white dark:bg-black border-2 border-black/10 dark:border-white/10 rounded-2xl shadow-2xl z-50 animate-scale-in overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-black/10 dark:border-white/10 flex items-center justify-between">
              <h3 className="text-lg font-bold text-black dark:text-white">
                Notifications
              </h3>
              <div className="flex items-center gap-2">
                {notifications.length > 0 && (
                  <>
                    <button
                      onClick={markAllAsRead}
                      className="text-xs text-blue-500 hover:text-blue-600 font-medium"
                    >
                      Mark all read
                    </button>
                    <span className="text-black/20 dark:text-white/20">|</span>
                    <button
                      onClick={clearAll}
                      className="text-xs text-red-500 hover:text-red-600 font-medium"
                    >
                      Clear all
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Notifications List */}
            <div className="max-h-[500px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <svg
                    className="w-16 h-16 mx-auto mb-4 text-black/20 dark:text-white/20"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                    />
                  </svg>
                  <p className="text-black/60 dark:text-white/60">No notifications yet</p>
                  <p className="text-xs text-black/40 dark:text-white/40 mt-1">
                    We'll notify you when something happens
                  </p>
                </div>
              ) : (
                notifications.map((notification) => (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`p-4 border-b border-black/5 dark:border-white/5 cursor-pointer transition-all hover:bg-black/5 dark:hover:bg-white/5 ${
                      !notification.read ? 'bg-blue-50 dark:bg-blue-950/20' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Icon */}
                      <div
                        className={`flex-shrink-0 w-10 h-10 ${notification.color} rounded-full flex items-center justify-center text-white text-xl`}
                      >
                        {notification.icon}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h4 className="font-semibold text-sm text-black dark:text-white">
                            {notification.title}
                          </h4>
                          {!notification.read && (
                            <span className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full"></span>
                          )}
                        </div>
                        <p className="text-sm text-black/70 dark:text-white/70 mb-1 line-clamp-2">
                          {notification.message}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-black/50 dark:text-white/50">
                          <span>{formatTimestamp(notification.timestamp)}</span>
                          {notification.ticketId && (
                            <>
                              <span>•</span>
                              <span className="font-mono">{notification.ticketId}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="p-3 border-t border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5">
                <button
                  onClick={() => {
                    navigate('/notifications');
                    setShowDropdown(false);
                  }}
                  className="w-full text-sm text-blue-500 hover:text-blue-600 font-medium"
                >
                  View All Notifications →
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default EnhancedNotificationBell;
