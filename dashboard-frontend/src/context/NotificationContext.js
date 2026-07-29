import React, { createContext, useContext, useState, useEffect } from 'react';
import io from 'socket.io-client';

const NotificationContext = createContext();

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    // Connect to WebSocket server (strip /api from URL if present)
    const socketUrl = process.env.REACT_APP_SOCKET_URL;
    if (!socketUrl) return;
    
    const newSocket = io(socketUrl, {
      transports: ['websocket'],
      reconnection: true,
    });

    newSocket.on('connect', () => {
      console.log('✅ Notification WebSocket connected');
    });

    // Listen for new complaint notifications
    newSocket.on('new_complaint', (data) => {
      addNotification({
        id: Date.now(),
        type: 'complaint',
        title: 'New Complaint Received',
        message: `${data.ticketId}: ${data.query?.substring(0, 50)}...`,
        timestamp: new Date(),
        ticketId: data.ticketId,
        priority: data.priority,
        department: data.department,
        read: false,
      });
    });

    // Listen for work completion notifications
    newSocket.on('work_completed', (data) => {
      addNotification({
        id: Date.now(),
        type: 'completion',
        title: 'Work Completed',
        message: `Worker ${data.workerName} completed ${data.ticketId}`,
        timestamp: new Date(),
        ticketId: data.ticketId,
        workerId: data.workerId,
        read: false,
      });
    });

    // Listen for worker assignment confirmations
    newSocket.on('worker_assigned', (data) => {
      addNotification({
        id: Date.now(),
        type: 'assignment',
        title: 'Worker Assigned',
        message: `${data.workerName} assigned to ${data.ticketId}`,
        timestamp: new Date(),
        ticketId: data.ticketId,
        read: false,
      });
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const addNotification = (notification) => {
    setNotifications((prev) => [notification, ...prev]);
    setUnreadCount((prev) => prev + 1);

    // Play notification sound
    const audio = new Audio('/notification.mp3');
    audio.play().catch(() => {}); // Ignore autoplay errors

    // Show browser notification if permitted
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.message,
        icon: '/logo192.png',
        badge: '/logo192.png',
      });
    }
  };

  const markAsRead = (notificationId) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const clearNotification = (notificationId) => {
    setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
    const wasUnread = notifications.find((n) => n.id === notificationId && !n.read);
    if (wasUnread) {
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
  };

  const clearAll = () => {
    setNotifications([]);
    setUnreadCount(0);
  };

  const requestPermission = async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        addNotification,
        markAsRead,
        markAllAsRead,
        clearNotification,
        clearAll,
        requestPermission,
        socket,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};
