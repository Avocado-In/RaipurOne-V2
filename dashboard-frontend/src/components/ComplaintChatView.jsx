import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const ComplaintChatView = ({ ticket, onClose }) => {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadMessages();
  }, [ticket]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadMessages = () => {
    const msgs = [];
    
    // Initial complaint message
    msgs.push({
      id: `initial_${ticket.ticketId}`,
      type: 'user',
      text: ticket.query,
      timestamp: ticket.createdAt,
      sender: {
        name: ticket.firstName || ticket.username || 'User',
        phone: ticket.phoneNumber,
      },
      status: 'read',
    });

    // Status updates as system messages
    if (ticket.status === 'in-progress') {
      msgs.push({
        id: `status_progress_${ticket.ticketId}`,
        type: 'system',
        text: `Ticket assigned to worker`,
        timestamp: ticket.assigned_at || ticket.updatedAt,
      });
    }

    if (ticket.status === 'resolved') {
      msgs.push({
        id: `status_resolved_${ticket.ticketId}`,
        type: 'system',
        text: `✅ Ticket marked as resolved`,
        timestamp: ticket.resolved_at || ticket.updatedAt,
      });
    }

    // Admin responses (if any)
    if (ticket.responses && Array.isArray(ticket.responses)) {
      ticket.responses.forEach((response, index) => {
        msgs.push({
          id: `response_${index}`,
          type: 'admin',
          text: response.message,
          timestamp: response.timestamp,
          sender: {
            name: 'Admin',
          },
          status: 'read',
        });
      });
    }

    setMessages(msgs);
  };

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;

    setSending(true);
    try {
      // Send to backend API
      const response = await axios.post(`http://127.0.0.1:8000/tickets/${ticket.ticketId}/response`, {
        message: inputText
      });

      const newMessage = {
        id: `msg_${Date.now()}`,
        type: 'admin',
        text: inputText,
        timestamp: new Date().toISOString(),
        sender: { name: 'Admin' },
        status: 'sent',
      };

      setMessages(prev => [...prev, newMessage]);
      setInputText('');

      // Show success notification
      console.log('Response sent successfully:', response.data);
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send response. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      for (const file of files) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const mediaMessage = {
            id: `media_${Date.now()}_${Math.random()}`,
            type: 'admin',
            media: [{
              url: e.target.result,
              type: file.type.startsWith('image/') ? 'image' : 'video',
              name: file.name,
            }],
            timestamp: new Date().toISOString(),
            sender: { name: 'Admin' },
            status: 'sent',
          };
          setMessages(prev => [...prev, mediaMessage]);
        };
        reader.readAsDataURL(file);
      }
    } catch (error) {
      console.error('Error uploading file:', error);
    } finally {
      setUploading(false);
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
  };

  const MessageBubble = ({ message }) => {
    const isUser = message.type === 'user';
    const isSystem = message.type === 'system';
    const isAdmin = message.type === 'admin';

    if (isSystem) {
      return (
        <div className="flex justify-center my-4">
          <div className="bg-black/10 dark:bg-white/10 px-4 py-2 rounded-lg text-xs text-black/70 dark:text-white/70 max-w-xs text-center">
            {message.text}
          </div>
        </div>
      );
    }

    return (
      <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
        <div className={`max-w-[70%] ${isUser ? 'order-2' : 'order-1'}`}>
          {/* Sender name */}
          {!isUser && (
            <div className="text-xs text-black/60 dark:text-white/60 mb-1 px-2">
              {message.sender.name}
            </div>
          )}

          {/* Message bubble */}
          <div
            className={`rounded-2xl px-4 py-2 ${
              isUser
                ? 'bg-blue-500 text-white rounded-br-sm'
                : 'bg-black/10 dark:bg-white/10 text-black dark:text-white rounded-bl-sm'
            }`}
          >
            {/* Media attachments */}
            {message.media && message.media.length > 0 && (
              <div className="space-y-2 mb-2">
                {message.media.map((media, index) => (
                  <div key={index} className="rounded-lg overflow-hidden">
                    {media.type === 'image' ? (
                      <img
                        src={media.url}
                        alt={media.name}
                        className="max-w-full h-auto rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => window.open(media.url, '_blank')}
                      />
                    ) : (
                      <video
                        src={media.url}
                        controls
                        className="max-w-full h-auto rounded-lg"
                      >
                        Your browser does not support video playback.
                      </video>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Text content */}
            {message.text && (
              <div className="text-sm whitespace-pre-wrap break-words">
                {message.text}
              </div>
            )}

            {/* Timestamp and status */}
            <div className={`flex items-center justify-end gap-1 mt-1 text-xs ${
              isUser ? 'text-white/70' : 'text-black/50 dark:text-white/50'
            }`}>
              <span>{formatTime(message.timestamp)}</span>
              {isUser && message.status && (
                <span>
                  {message.status === 'sent' && '✓'}
                  {message.status === 'delivered' && '✓✓'}
                  {message.status === 'read' && '✓✓'}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/60 dark:bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-black border-2 border-black/20 dark:border-white/20 rounded-3xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-blue-500 dark:bg-blue-600 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center font-bold">
              {(ticket.firstName || ticket.username || 'U').charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="font-semibold">{ticket.ticketId}</h3>
              <p className="text-xs opacity-90">
                {ticket.status === 'open' && '⚪ Open'}
                {ticket.status === 'in-progress' && '🟡 In Progress'}
                {ticket.status === 'resolved' && '🟢 Resolved'}
                {ticket.status === 'closed' && '⚫ Closed'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 bg-[#E5DDD5] dark:bg-[#0B141A]" style={{ 
          backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23000000\' fill-opacity=\'0.02\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
        }}>
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white dark:bg-black border-t border-black/10 dark:border-white/10">
          <div className="flex items-end gap-2">
            {/* Attach button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="p-3 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors disabled:opacity-50"
            >
              {uploading ? (
                <div className="w-5 h-5 border-2 border-black/20 dark:border-white/20 border-t-black dark:border-t-white rounded-full animate-spin"></div>
              ) : (
                <svg className="w-5 h-5 text-black dark:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              onChange={handleFileUpload}
              className="hidden"
            />

            {/* Text input */}
            <div className="flex-1 relative">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="Type a message..."
                rows={1}
                className="w-full px-4 py-3 pr-12 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-full text-black dark:text-white placeholder-black/40 dark:placeholder-white/40 focus:outline-none focus:border-blue-500 resize-none"
                style={{ minHeight: '48px', maxHeight: '120px' }}
              />
            </div>

            {/* Send button */}
            <button
              onClick={handleSendMessage}
              disabled={!inputText.trim() || sending}
              className="p-3 bg-blue-500 hover:bg-blue-600 disabled:bg-black/10 dark:disabled:bg-white/10 disabled:cursor-not-allowed rounded-full transition-colors"
            >
              {sending ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComplaintChatView;
