import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TicketViewer from '../components/TicketViewer';
import { imageAPI } from '../api';

jest.mock('../api', () => ({
  imageAPI: { getTicketImages: jest.fn() },
}));

// This exercises src/components/TicketViewer.js - the component TicketsList imports and
// the one module resolution picks. It takes its images from the ticket prop and reports
// actions back through callbacks; it does not fetch anything itself.
const mockTicket = {
  ticketId: 'TICKET-001',
  description: 'Sewage overflowing outside the bus stand',
  status: 'open',
  department: 'WATER',
  priority: 'high',
  username: 'John',
  userId: 'citizen-9',
  createdAt: new Date('2025-01-01').toISOString(),
  location: { lat: 21.2514, lng: 81.6296 },
  images: [
    { url: 'https://example.com/image1.jpg' },
    { url: 'https://example.com/image2.jpg' },
  ],
};

const renderViewer = (props = {}) =>
  render(
    <TicketViewer
      ticket={mockTicket}
      onClose={jest.fn()}
      onRespond={jest.fn()}
      onAssignWorker={jest.fn()}
      onUpdate={jest.fn()}
      {...props}
    />
  );

describe('TicketViewer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    imageAPI.getTicketImages.mockResolvedValue({ data: { success: true, images: [] } });
  });
  it('renders the ticket metadata', () => {
    renderViewer();

    expect(screen.getByText('TICKET-001')).toBeInTheDocument();
    expect(screen.getByText(/Sewage overflowing outside the bus stand/)).toBeInTheDocument();
    expect(screen.getByText('open')).toBeInTheDocument();
    expect(screen.getByText('WATER')).toBeInTheDocument();
    expect(screen.getByText('John')).toBeInTheDocument();
  });

  it('falls back to a placeholder when the ticket carries no description', () => {
    renderViewer({ ticket: { ...mockTicket, description: undefined, message: undefined, query: undefined } });

    expect(screen.getByText('No description provided')).toBeInTheDocument();
  });

  it('renders the attached images from the ticket', () => {
    renderViewer();

    expect(screen.getByText('Attached Images (2)')).toBeInTheDocument();
    expect(screen.getByAltText('Evidence 1')).toHaveAttribute('src', 'https://example.com/image1.jpg');
    expect(screen.getByAltText('Evidence 2')).toHaveAttribute('src', 'https://example.com/image2.jpg');
  });

  it('omits the gallery when the complaint genuinely has no images', async () => {
    renderViewer({ ticket: { ...mockTicket, images: [] } });

    await waitFor(() => expect(imageAPI.getTicketImages).toHaveBeenCalledWith('TICKET-001', expect.anything()));
    expect(screen.queryByText(/Attached Images/)).not.toBeInTheDocument();
  });

  it('fetches the images when the ticket payload does not carry them', async () => {
    // /tickets returns no `images` key, so without this fetch the Telegram photos
    // never appeared even though they upload and store correctly.
    imageAPI.getTicketImages.mockResolvedValue({
      data: { success: true, images: [{ url: 'https://example.com/signed-1.jpg' }] },
    });

    renderViewer({ ticket: { ...mockTicket, images: undefined } });

    expect(await screen.findByText('Attached Images (1)')).toBeInTheDocument();
    expect(screen.getByAltText('Evidence 1')).toHaveAttribute('src', 'https://example.com/signed-1.jpg');
  });

  it('does not refetch when the caller already supplied images', () => {
    renderViewer();

    expect(imageAPI.getTicketImages).not.toHaveBeenCalled();
  });

  it('opens a lightbox showing the image that was clicked', () => {
    renderViewer();

    fireEvent.click(screen.getByAltText('Evidence 2'));

    expect(screen.getByAltText('Full view')).toHaveAttribute('src', 'https://example.com/image2.jpg');
  });

  it('keeps the send button disabled until a response is typed', () => {
    renderViewer();

    const button = screen.getByRole('button', { name: 'Send Response' });
    expect(button).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText('Type your response to the user...'), {
      target: { value: 'A crew has been scheduled.' },
    });

    expect(button).toBeEnabled();
  });

  it('sends the response through onRespond and clears the box', async () => {
    const onRespond = jest.fn().mockResolvedValue(undefined);
    renderViewer({ onRespond });

    const textarea = screen.getByPlaceholderText('Type your response to the user...');
    fireEvent.change(textarea, { target: { value: 'A crew has been scheduled.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send Response' }));

    await waitFor(() => {
      expect(onRespond).toHaveBeenCalledWith('TICKET-001', 'A crew has been scheduled.');
    });
    await waitFor(() => expect(textarea).toHaveValue(''));
  });

  it('shows the response history when the ticket has one', () => {
    renderViewer({
      ticket: {
        ...mockTicket,
        responses: [{ message: 'Team dispatched', createdAt: new Date('2025-01-02').toISOString() }],
      },
    });

    expect(screen.getByText('Response History (1)')).toBeInTheDocument();
    expect(screen.getByText('Team dispatched')).toBeInTheDocument();
  });

  it('defaults the location to Raipur when the ticket has no coordinates', () => {
    renderViewer({ ticket: { ...mockTicket, location: undefined } });

    expect(screen.getByText('21.2514, 81.6296')).toBeInTheDocument();
  });
});
