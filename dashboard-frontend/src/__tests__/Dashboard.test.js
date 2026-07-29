import { render, screen, waitFor } from '@testing-library/react';
import Dashboard from '../pages/Dashboard';
import { ticketAPI } from '../api';

jest.mock('../api', () => ({
  ticketAPI: {
    getDashboardStats: jest.fn(),
    getAllTickets: jest.fn(),
  },
}));

jest.mock('../components/StatCard', () => () => <div data-testid="stat-card" />);
jest.mock('../components/TicketCard', () => ({ ticket }) => <div data-testid="ticket-card">{ticket.title}</div>);
jest.mock('../components/AnalyticsDashboard', () => () => <div data-testid="analytics-dashboard" />);

describe('Dashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders dashboard data when the backend returns the live payload shape', async () => {
    ticketAPI.getDashboardStats.mockResolvedValue({
      data: { success: true, data: { totalTickets: 2, openTickets: 1, resolvedTickets: 1, inProgressTickets: 0, totalUsers: 4 } },
    });
    ticketAPI.getAllTickets.mockResolvedValue({
      data: [{ id: '1', title: 'Broken light', description: 'Need repair' }],
    });

    render(<Dashboard />);

    await waitFor(() => expect(screen.getByText('Dashboard')).toBeInTheDocument());
    expect(screen.getByText('Broken light')).toBeInTheDocument();
    expect(screen.getByTestId('analytics-dashboard')).toBeInTheDocument();
  });
});
