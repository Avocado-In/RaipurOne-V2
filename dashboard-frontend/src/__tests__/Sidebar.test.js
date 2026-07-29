import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Sidebar from '../components/Sidebar';

const renderWithRouter = (component) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('Sidebar', () => {
  it('should render sidebar with navigation items', () => {
    renderWithRouter(<Sidebar />);
    
    expect(screen.getByText('R1 Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Tickets')).toBeInTheDocument();
    expect(screen.getByText('Statistics')).toBeInTheDocument();
    expect(screen.getByText('Departments')).toBeInTheDocument();
  });

  it('should toggle collapse state', () => {
    renderWithRouter(<Sidebar />);
    
    const toggleButton = screen.getByLabelText('Collapse sidebar');
    expect(toggleButton).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(toggleButton);
    expect(toggleButton).toHaveAttribute('aria-expanded', 'false');
    expect(toggleButton).toHaveAttribute('aria-label', 'Expand sidebar');
  });

  it('should display theme switcher', () => {
    renderWithRouter(<Sidebar />);
    
    const themeSwitcher = screen.getByRole('button', { name: /switch to/i });
    expect(themeSwitcher).toBeInTheDocument();
  });

  it('should have proper accessibility attributes', () => {
    renderWithRouter(<Sidebar />);
    
    const sidebar = screen.getByLabelText('Main navigation');
    expect(sidebar).toBeInTheDocument();
    
    const nav = screen.getByRole('navigation');
    expect(nav).toBeInTheDocument();
  });
});
