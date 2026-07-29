import React, { useState, useEffect, useCallback } from 'react';
import {
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import { TrendingUp, Users, CheckCircle, Clock } from 'lucide-react';
import axios from 'axios';
import './AnalyticsDashboard.css';

const AnalyticsDashboard = ({ apiUrl }) => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('7d');

  const generateMockData = useCallback(() => {
    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
    const ticketTrend = [];
    const workerPerformance = [
      { name: 'John Doe', completed: 45, inProgress: 5, rating: 4.8 },
      { name: 'Jane Smith', completed: 38, inProgress: 7, rating: 4.6 },
      { name: 'Mike Johnson', completed: 52, inProgress: 3, rating: 4.9 },
      { name: 'Sarah Williams', completed: 41, inProgress: 6, rating: 4.7 },
      { name: 'Tom Brown', completed: 35, inProgress: 8, rating: 4.5 },
    ];

    for (let i = days; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      ticketTrend.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        created: Math.floor(Math.random() * 20) + 5,
        completed: Math.floor(Math.random() * 15) + 5,
        pending: Math.floor(Math.random() * 10) + 2,
      });
    }

    return {
      summary: {
        totalTickets: 1247,
        completedTickets: 892,
        pendingTickets: 245,
        inProgressTickets: 110,
        activeWorkers: 24,
        responseTime: '2.4 hrs',
        completionRate: 71.5,
        customerSatisfaction: 4.6,
      },
      ticketTrend,
      workerPerformance,
      departmentDistribution: [
        { name: 'Sanitation', value: 435, color: '#3b82f6' },
        { name: 'Infrastructure', value: 312, color: '#10b981' },
        { name: 'Public Safety', value: 245, color: '#f59e0b' },
        { name: 'Utilities', value: 155, color: '#ef4444' },
        { name: 'Others', value: 100, color: '#8b5cf6' },
      ],
      statusDistribution: [
        { name: 'Completed', value: 892, color: '#10b981' },
        { name: 'Pending', value: 245, color: '#f59e0b' },
        { name: 'In Progress', value: 110, color: '#3b82f6' },
      ],
    };
  }, [timeRange]);

  const fetchAnalytics = useCallback(async () => {
    try {
      const response = await axios.get(`${apiUrl}/api/analytics?range=${timeRange}`);
      setAnalytics(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      // Use mock data for demonstration
      setAnalytics(generateMockData());
      setLoading(false);
    }
  }, [apiUrl, generateMockData, timeRange]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  if (loading) {
    return <div className="analytics-loading">Loading analytics...</div>;
  }

  const { summary, ticketTrend, workerPerformance, departmentDistribution, statusDistribution } =
    analytics;

  return (
    <div className="analytics-dashboard">
      <div className="analytics-header">
        <h2>Analytics & Insights</h2>
        <div className="time-range-selector">
          <button
            className={timeRange === '7d' ? 'active' : ''}
            onClick={() => setTimeRange('7d')}
          >
            7 Days
          </button>
          <button
            className={timeRange === '30d' ? 'active' : ''}
            onClick={() => setTimeRange('30d')}
          >
            30 Days
          </button>
          <button
            className={timeRange === '90d' ? 'active' : ''}
            onClick={() => setTimeRange('90d')}
          >
            90 Days
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="summary-grid">
        <div className="summary-card primary">
          <div className="card-icon">
            <TrendingUp />
          </div>
          <div className="card-content">
            <div className="card-value">{summary.totalTickets}</div>
            <div className="card-label">Total Tickets</div>
            <div className="card-trend positive">+12.5% vs last period</div>
          </div>
        </div>

        <div className="summary-card success">
          <div className="card-icon">
            <CheckCircle />
          </div>
          <div className="card-content">
            <div className="card-value">{summary.completedTickets}</div>
            <div className="card-label">Completed</div>
            <div className="card-trend positive">
              {summary.completionRate}% completion rate
            </div>
          </div>
        </div>

        <div className="summary-card warning">
          <div className="card-icon">
            <Clock />
          </div>
          <div className="card-content">
            <div className="card-value">{summary.pendingTickets}</div>
            <div className="card-label">Pending</div>
            <div className="card-trend">{summary.responseTime} avg response</div>
          </div>
        </div>

        <div className="summary-card info">
          <div className="card-icon">
            <Users />
          </div>
          <div className="card-content">
            <div className="card-value">{summary.activeWorkers}</div>
            <div className="card-label">Active Workers</div>
            <div className="card-trend positive">
              ⭐ {summary.customerSatisfaction} rating
            </div>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="charts-grid">
        {/* Ticket Trend */}
        <div className="chart-card full-width">
          <h3>Ticket Trends</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={ticketTrend}>
              <defs>
                <linearGradient id="colorCreated" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis dataKey="date" stroke="var(--text-secondary)" />
              <YAxis stroke="var(--text-secondary)" />
              <Tooltip
                contentStyle={{
                  background: 'var(--surface-color)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                }}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="created"
                stroke="#3b82f6"
                fillOpacity={1}
                fill="url(#colorCreated)"
                name="Created"
              />
              <Area
                type="monotone"
                dataKey="completed"
                stroke="#10b981"
                fillOpacity={1}
                fill="url(#colorCompleted)"
                name="Completed"
              />
              <Line
                type="monotone"
                dataKey="pending"
                stroke="#f59e0b"
                strokeWidth={2}
                name="Pending"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Worker Performance */}
        <div className="chart-card">
          <h3>Worker Performance</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={workerPerformance}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis dataKey="name" stroke="var(--text-secondary)" />
              <YAxis stroke="var(--text-secondary)" />
              <Tooltip
                contentStyle={{
                  background: 'var(--surface-color)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                }}
              />
              <Legend />
              <Bar dataKey="completed" fill="#10b981" name="Completed" radius={[8, 8, 0, 0]} />
              <Bar dataKey="inProgress" fill="#3b82f6" name="In Progress" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Department Distribution */}
        <div className="chart-card">
          <h3>Department Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={departmentDistribution}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry) => entry.name}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {departmentDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Status Distribution */}
        <div className="chart-card half-width">
          <h3>Status Overview</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={statusDistribution}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                fill="#8884d8"
                paddingAngle={5}
                dataKey="value"
                label={(entry) => `${entry.name}: ${entry.value}`}
              >
                {statusDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
