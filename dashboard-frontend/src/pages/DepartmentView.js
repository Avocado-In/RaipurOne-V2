import React, { useState, useEffect } from 'react';
import { analysisAPI } from '../api';
import './DepartmentView.css';

function DepartmentView() {
  const [stats, setStats] = useState(null);
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDepartmentStats();
  }, []);

  useEffect(() => {
    if (selectedDepartment !== 'all') {
      fetchDepartmentTickets(selectedDepartment);
    }
  }, [selectedDepartment]);

  const fetchDepartmentStats = async () => {
    try {
      setLoading(true);
      const response = await analysisAPI.getDepartmentStats();
      setStats(response.data.data);
      setError(null);
    } catch (err) {
      console.error('Error fetching department stats:', err);
      setError('Failed to load department statistics');
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartmentTickets = async (department) => {
    try {
      setLoading(true);
      const response = await analysisAPI.getTicketsByDepartment(department);
      setTickets(response.data.data);
      setError(null);
    } catch (err) {
      console.error('Error fetching tickets:', err);
      setError('Failed to load tickets');
    } finally {
      setLoading(false);
    }
  };

  const getRequestTypeColor = (type) => {
    const colors = {
      valid: '#48bb78',
      invalid: '#f6ad55',
      garbage: '#fc8181',
    };
    return colors[type] || '#718096';
  };

  const getDepartmentIcon = (dept) => {
    const icons = {
      roadway: '🛣️',
      cleaning: '🧹',
      drainage: '�',
      'water-supply': '💧',
      general: '📋',
      invalid: '⚠️',
      garbage: '🗑️',
    };
    return icons[dept] || '📁';
  };

  if (loading && !stats) {
    return <div style={{ textAlign: 'center', padding: '40px' }}>⏳ Loading...</div>;
  }

  if (error && !stats) {
    return <div style={{ textAlign: 'center', padding: '40px', color: '#f56565' }}>❌ {error}</div>;
  }

  return (
    <div className="department-view">
      <h2>🏢 Department Analysis Dashboard</h2>

      {/* Statistics Overview */}
      <div className="stats-grid">
        <div className="stat-box">
          <h3>Total Analyzed</h3>
          <div className="stat-number">{stats?.total || 0}</div>
        </div>

        {stats?.byRequestType?.map((item) => (
          <div key={item._id} className="stat-box" style={{ borderTop: `4px solid ${getRequestTypeColor(item._id)}` }}>
            <h3>{item._id.charAt(0).toUpperCase() + item._id.slice(1)} Requests</h3>
            <div className="stat-number">{item.count}</div>
          </div>
        ))}
      </div>

      {/* Department Breakdown */}
      <div className="department-section">
        <h3>📊 By Department</h3>
        <div className="department-grid">
          {stats?.byDepartment?.map((dept) => (
            <div
              key={dept._id}
              className={`department-card ${selectedDepartment === dept._id ? 'active' : ''}`}
              onClick={() => setSelectedDepartment(dept._id)}
            >
              <div className="dept-icon">{getDepartmentIcon(dept._id)}</div>
              <h4>{dept._id.charAt(0).toUpperCase() + dept._id.slice(1)}</h4>
              <div className="dept-count">{dept.count} tickets</div>
            </div>
          ))}
        </div>
      </div>

      {/* Selected Department Tickets */}
      {selectedDepartment !== 'all' && (
        <div className="tickets-section">
          <h3>
            {getDepartmentIcon(selectedDepartment)} {selectedDepartment.charAt(0).toUpperCase() + selectedDepartment.slice(1)} Department Tickets
          </h3>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '20px' }}>Loading tickets...</div>
          ) : tickets.length === 0 ? (
            <div className="empty-state">No tickets in this department</div>
          ) : (
            <div className="tickets-list">
              {tickets.map((ticket) => (
                <div key={ticket._id} className="ticket-item">
                  <div className="ticket-header">
                    <span className="ticket-id">{ticket.ticketId}</span>
                    <span className="ticket-type" style={{ background: getRequestTypeColor(ticket.requestType) }}>
                      {ticket.requestType}
                    </span>
                    <span className="ticket-priority priority-{ticket.priority}">{ticket.priority}</span>
                  </div>
                  <div className="ticket-summary">
                    <strong>Summary:</strong> {ticket.simplifiedSummary}
                  </div>
                  <div className="ticket-original">
                    <strong>Original Query:</strong> {ticket.originalQuery}
                  </div>
                  <div className="ticket-analysis">
                    <div><strong>Confidence:</strong> {ticket.geminiAnalysis?.confidence}%</div>
                    <div><strong>Reasoning:</strong> {ticket.geminiAnalysis?.reasoning}</div>
                  </div>
                  {ticket.geminiAnalysis?.suggestedActions && ticket.geminiAnalysis.suggestedActions.length > 0 && (
                    <div className="suggested-actions">
                      <strong>Suggested Actions:</strong>
                      <ul>
                        {ticket.geminiAnalysis.suggestedActions.map((action, idx) => (
                          <li key={idx}>{action}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="ticket-footer">
                    <span>User: {ticket.username || 'Anonymous'}</span>
                    <span>Created: {new Date(ticket.createdAt).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default DepartmentView;
