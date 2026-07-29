import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import TicketViewer from '../components/TicketViewer';
import { geminiAPI, imageAPI } from '../api';

// Mock API modules
jest.mock('../api', () => ({
  geminiAPI: {
    transcribeImage: jest.fn(),
  },
  imageAPI: {
    getTicketImages: jest.fn(),
  },
}));

const mockTicket = {
  ticketId: 'TICKET-001',
  query: 'Test ticket query description',
  status: 'open',
  category: 'general',
  priority: 'medium',
  firstName: 'John',
  createdAt: new Date('2025-01-01').toISOString(),
};

const mockImages = [
  {
    id: 1,
    url: 'https://example.com/image1.jpg',
    fileName: 'image1.jpg',
    created_at: new Date('2025-01-01').toISOString(),
  },
  {
    id: 2,
    url: 'https://example.com/image2.jpg',
    fileName: 'image2.jpg',
    created_at: new Date('2025-01-01').toISOString(),
  },
];

describe('TicketViewer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders ticket metadata correctly', async () => {
    imageAPI.getTicketImages.mockResolvedValue({
      data: { images: [] },
    });

    render(<TicketViewer ticket={mockTicket} />);

    expect(screen.getByText('TICKET-001')).toBeInTheDocument();
    expect(screen.getByText(/Test ticket query description/)).toBeInTheDocument();
    expect(screen.getByText('open')).toBeInTheDocument();
    expect(screen.getByText('John')).toBeInTheDocument();
  });

  test('displays loading state while fetching images', () => {
    imageAPI.getTicketImages.mockImplementation(() => new Promise(() => {}));

    render(<TicketViewer ticket={mockTicket} />);

    expect(screen.getByText(/Loading images.../)).toBeInTheDocument();
  });

  test('displays images when loaded', async () => {
    imageAPI.getTicketImages.mockResolvedValue({
      data: { images: mockImages },
    });

    render(<TicketViewer ticket={mockTicket} />);

    await waitFor(() => {
      expect(screen.getByAltText('Ticket attachment')).toBeInTheDocument();
    });

    // Check thumbnails are rendered
    const thumbnails = screen.getAllByRole('button').filter(btn => 
      btn.querySelector('img') && btn.querySelector('img').alt.includes('Thumbnail')
    );
    expect(thumbnails).toHaveLength(2);
  });

  test('transcribe button calls API and displays result', async () => {
    const mockTranscription = {
      data: {
        data: {
          transcription: 'Test transcription result from Gemini',
          confidence: 95,
        },
      },
    };

    imageAPI.getTicketImages.mockResolvedValue({
      data: { images: mockImages },
    });
    geminiAPI.transcribeImage.mockResolvedValue(mockTranscription);

    render(<TicketViewer ticket={mockTicket} />);

    // Wait for images to load
    await waitFor(() => {
      expect(screen.getByText(/Transcribe Image/)).toBeInTheDocument();
    });

    const transcribeButton = screen.getByText(/Transcribe Image/).closest('button');
    
    // Click transcribe button
    fireEvent.click(transcribeButton);

    // Check loading state
    await waitFor(() => {
      expect(screen.getByText(/Transcribing.../)).toBeInTheDocument();
    });

    // Verify API was called with correct image URL
    expect(geminiAPI.transcribeImage).toHaveBeenCalledWith(mockImages[0].url);

    // Wait for transcription result
    await waitFor(() => {
      expect(screen.getByText(/Test transcription result from Gemini/)).toBeInTheDocument();
    });
  });

  test('displays error when transcription fails', async () => {
    imageAPI.getTicketImages.mockResolvedValue({
      data: { images: mockImages },
    });
    geminiAPI.transcribeImage.mockRejectedValue(new Error('API Error'));

    render(<TicketViewer ticket={mockTicket} />);

    await waitFor(() => {
      expect(screen.getByText(/Transcribe Image/)).toBeInTheDocument();
    });

    const transcribeButton = screen.getByText(/Transcribe Image/).closest('button');
    fireEvent.click(transcribeButton);

    await waitFor(() => {
      expect(screen.getByText(/Unable to transcribe image/)).toBeInTheDocument();
    });
  });

  test('transcribe button is disabled when no image is selected', async () => {
    imageAPI.getTicketImages.mockResolvedValue({
      data: { images: [] },
    });

    render(<TicketViewer ticket={mockTicket} />);

    await waitFor(() => {
      const transcribeButton = screen.getByText(/Transcribe Image/).closest('button');
      expect(transcribeButton).toBeDisabled();
    });
  });

  test('opens lightbox when image is clicked', async () => {
    imageAPI.getTicketImages.mockResolvedValue({
      data: { images: mockImages },
    });

    render(<TicketViewer ticket={mockTicket} />);

    await waitFor(() => {
      expect(screen.getByAltText('Ticket attachment')).toBeInTheDocument();
    });

    const imagePreview = screen.getByAltText('Ticket attachment').closest('div');
    fireEvent.click(imagePreview);

    // Check for lightbox elements
    await waitFor(() => {
      expect(screen.getByAltText('Zoomed ticket attachment')).toBeInTheDocument();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  test('switches between images when clicking thumbnails', async () => {
    imageAPI.getTicketImages.mockResolvedValue({
      data: { images: mockImages },
    });

    render(<TicketViewer ticket={mockTicket} />);

    await waitFor(() => {
      const thumbnails = screen.getAllByRole('button').filter(btn => 
        btn.querySelector('img') && btn.querySelector('img').alt.includes('Thumbnail')
      );
      expect(thumbnails).toHaveLength(2);

      // Click second thumbnail
      fireEvent.click(thumbnails[1]);

      // Verify main image changed (src should be mockImages[1].url)
      const mainImage = screen.getByAltText('Ticket attachment');
      expect(mainImage).toHaveAttribute('src', mockImages[1].url);
    });
  });

  test('renders "No ticket selected" when ticket prop is null', () => {
    render(<TicketViewer ticket={null} />);

    expect(screen.getByText(/No ticket selected/)).toBeInTheDocument();
  });

  test('respects prefers-reduced-motion for animations', async () => {
    // Mock matchMedia for reduced motion
    window.matchMedia = jest.fn().mockImplementation(query => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }));

    imageAPI.getTicketImages.mockResolvedValue({
      data: { images: mockImages },
    });

    render(<TicketViewer ticket={mockTicket} />);

    // Ensure component renders without errors
    await waitFor(() => {
      expect(screen.getByText('TICKET-001')).toBeInTheDocument();
    });
  });
});
