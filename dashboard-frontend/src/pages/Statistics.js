import React, { useState, useEffect } from 'react';
import { ticketAPI } from '../api';
import './Statistics.css';

function Statistics() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await ticketAPI.getDashboardStats();
      setStats(response.data.data);
      setError(null);
    } catch (err) {
      console.error('Error fetching statistics:', err);
      setError('Failed to load statistics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '40px' }}>⏳ Loading statistics...</div>;
  }

  if (error) {
    return <div style={{ textAlign: 'center', padding: '40px', color: '#f56565' }}>❌ {error}</div>;
  }

  const categoryData = stats?.ticketsByCategory || [];
  const priorityData = stats?.ticketsByPriority || [];

  return (
    <div className="statistics-page">
      <div className="stats-container">
        <div className="chart-card">
          <h3>📁 Tickets by Category</h3>
          <div className="chart-wrapper">
            {categoryData.length > 0 ? (
              <div style={{ width: '100%' }}>
                <table style={{ width: '100%', textAlign: 'left' }}>
                  <tbody>
                    {categoryData.map((item) => (
                      <tr key={item._id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '10px 0', color: '#333', fontWeight: '500' }}>
                          {item._id}
                        </td>
                        <td style={{ padding: '10px 0', textAlign: 'right', color: '#667eea', fontWeight: 'bold' }}>
                          {item.count}
                        </td>
                        <td style={{ padding: '10px 0 10px 20px', textAlign: 'left' }}>
                          <div
                            style={{
                              width: `${(item.count / (stats?.totalTickets || 1)) * 100}%`,
                              height: '8px',
                              background: '#667eea',
                              borderRadius: '4px',
                              minWidth: '20px',
                            }}
                          ></div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="no-data">No category data available</div>
            )}
          </div>
        </div>

        <div className="chart-card">
          <h3>🎯 Tickets by Priority</h3>
          <div className="chart-wrapper">
            {priorityData.length > 0 ? (
              <div style={{ width: '100%' }}>
                <table style={{ width: '100%', textAlign: 'left' }}>
                  <tbody>
                    {priorityData.map((item) => (
                      <tr key={item._id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '10px 0', color: '#333', fontWeight: '500' }}>
                          {item._id}
                        </td>
                        <td style={{ padding: '10px 0', textAlign: 'right', color: '#667eea', fontWeight: 'bold' }}>
                          {item.count}
                        </td>
                        <td style={{ padding: '10px 0 10px 20px', textAlign: 'left' }}>
                          <div
                            style={{
                              width: `${(item.count / (stats?.totalTickets || 1)) * 100}%`,
                              height: '8px',
                              background: '#764ba2',
                              borderRadius: '4px',
                              minWidth: '20px',
                            }}
                          ></div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="no-data">No priority data available</div>
            )}
          </div>
        </div>

        <div className="chart-card">
          <h3> Summary</h3>
          <div style={{ marginTop: '20px' }}>
            <div style={{ marginBottom: '15px', paddingBottom: '15px', borderBottom: '1px solid #eee' }}>
              <div style={{ color: '#999', fontSize: '12px', marginBottom: '5px' }}>Total Tickets</div>
              <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#667eea' }}>
                {stats?.totalTickets || 0}
              </div>
            </div>
            <div style={{ marginBottom: '15px', paddingBottom: '15px', borderBottom: '1px solid #eee' }}>
              <div style={{ color: '#999', fontSize: '12px', marginBottom: '5px' }}>Total Users</div>
              <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#48bb78' }}>
                {stats?.totalUsers || 0}
              </div>
            </div>
            <div style={{ marginBottom: '15px', paddingBottom: '15px', borderBottom: '1px solid #eee' }}>
              <div style={{ color: '#999', fontSize: '12px', marginBottom: '5px' }}>Resolution Rate</div>
              <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#ed8936' }}>
                {stats?.totalTickets > 0
                  ? ((((stats?.resolvedTickets || 0) + (stats?.closedTickets || 0)) / (stats?.totalTickets || 1)) * 100).toFixed(1)
                  : 0}
                %
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Statistics;
