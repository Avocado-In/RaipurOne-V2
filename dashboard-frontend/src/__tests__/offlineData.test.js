import { getOfflinePayload } from '../offlineData';

describe('offline fallback data', () => {
  it('returns demo stats for the dashboard endpoint', () => {
    const payload = getOfflinePayload('/dashboard/stats');

    // getOfflinePayload mimics an axios response, so the API body is payload.data
    // and the stats sit under its own `data` key - the same shape the real endpoint returns.
    expect(payload).toHaveProperty('data');
    expect(payload.data.data).toMatchObject({
      totalTickets: expect.any(Number),
      openTickets: expect.any(Number),
      resolvedTickets: expect.any(Number),
    });
  });

  it('returns demo tickets for the tickets listing endpoint', () => {
    const payload = getOfflinePayload('/tickets');

    expect(payload).toHaveProperty('data');
    expect(Array.isArray(payload.data.data)).toBe(true);
    expect(payload.data.data.length).toBeGreaterThan(0);
  });
});
