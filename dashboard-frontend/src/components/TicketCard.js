import React from 'react';
import { useNavigate } from 'react-router-dom';

const statusColors = {
  open: 'bg-black text-white dark:bg-white dark:text-black',
  'in-progress': 'bg-black/70 text-white dark:bg-white/70 dark:text-black',
  resolved: 'bg-black/50 text-white dark:bg-white/50 dark:text-black',
  closed: 'bg-black/30 text-white dark:bg-white/30 dark:text-black',
};

const priorityColors = {
  low: 'bg-green-500 text-white',
  medium: 'bg-yellow-500 text-black',
  high: 'bg-orange-500 text-white',
  urgent: 'bg-red-600 text-white',
};

const departmentColors = {
  WATER: 'bg-blue-500 text-white',
  ROAD: 'bg-gray-600 text-white',
  GARBAGE: 'bg-green-600 text-white',
  ELECTRICITY: 'bg-yellow-600 text-black',
  PARKS: 'bg-green-400 text-black',
  HEALTH: 'bg-red-500 text-white',
  SAFETY: 'bg-orange-600 text-white',
  GENERAL: 'bg-gray-500 text-white',
};

function TicketCard({ ticket, onClick }) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (onClick) {
      onClick(ticket);
    } else {
      // Use ticket_id or ticketId for URL
      const ticketId = ticket.ticket_id || ticket.ticketId || ticket.id;
      navigate(`/tickets/${ticketId}`);
    }
  };

  return (
    <div
      onClick={handleClick}
      className="bg-white dark:bg-black border border-black/10 dark:border-white/10 rounded-2xl p-6 cursor-pointer transition-all duration-200 hover:shadow-elevation-md hover:border-black/20 dark:hover:border-white/20"
    >
      {/* Header with Ticket ID, Department, and Status */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-mono font-bold text-black dark:text-white">
            {ticket.ticket_id || ticket.ticketId || 'N/A'}
          </span>
          {/* DEPARTMENT BADGE - PROMINENT */}
          {ticket.department && (
            <span className={`px-3 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${departmentColors[ticket.department] || departmentColors.GENERAL}`}>
              {ticket.department}
            </span>
          )}
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[ticket.status] || statusColors.open}`}>
          {ticket.status}
        </span>
      </div>

      {/* PRIORITY BADGE - LARGE */}
      {ticket.priority && (
        <div className="mb-3">
          <span className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide ${priorityColors[ticket.priority] || priorityColors.low}`}>
            🔥 {ticket.priority} PRIORITY
          </span>
        </div>
      )}

      <p className="text-base text-black dark:text-white font-medium mb-4 line-clamp-2">
        {ticket.description || ticket.message || ticket.query || 'No description provided'}
      </p>

      <div className="flex flex-wrap items-center gap-4 text-xs text-black/60 dark:text-white/60">
        <div className="flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <span>{ticket.first_name || ticket.firstName || ticket.username || 'Anonymous'}</span>
        </div>

        {ticket.category && (
          <div className="flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            <span>{ticket.category}</span>
          </div>
        )}

        <div className="flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span>
            {new Date(ticket.created_at || ticket.createdAt).toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </span>
        </div>
      </div>
    </div>
  );
}

export default TicketCard;

