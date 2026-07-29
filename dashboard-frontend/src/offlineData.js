const offlineTickets = [
  {
    _id: 'offline-001',
    ticketId: 'TCK-1001',
    title: 'Water leakage near Main Road',
    description: 'Water is leaking from a cracked pipeline near the market road and creating a hazard.',
    status: 'open',
    priority: 'high',
    category: 'technical',
    department: 'Water Supply',
    location: '21.2514,81.6296',
    createdAt: '2026-07-18T10:00:00.000Z',
    userId: 'user-1001',
    username: 'Citizen A',
  },
  {
    _id: 'offline-002',
    ticketId: 'TCK-1002',
    title: 'Garbage overflow near school',
    description: 'Garbage is overflowing at the community bin and causing a bad smell.',
    status: 'in-progress',
    priority: 'medium',
    category: 'support',
    department: 'Sanitation',
    location: '21.2525,81.6307',
    createdAt: '2026-07-19T09:15:00.000Z',
    userId: 'user-1002',
    username: 'Citizen B',
  },
  {
    _id: 'offline-003',
    ticketId: 'TCK-1003',
    title: 'Streetlight not working',
    description: 'The streetlight outside the park has been inactive for two days.',
    status: 'resolved',
    priority: 'low',
    category: 'general',
    department: 'Electrical',
    location: '21.2508,81.6288',
    createdAt: '2026-07-20T08:30:00.000Z',
    userId: 'user-1003',
    username: 'Citizen C',
  },
];

const offlineStats = {
  totalTickets: 12,
  openTickets: 5,
  inProgressTickets: 3,
  resolvedTickets: 4,
  totalUsers: 8,
};

const offlineDepartmentStats = {
  total: 12,
  byDepartment: [
    { _id: 'water-supply', count: 4 },
    { _id: 'cleaning', count: 3 },
    { _id: 'roadway', count: 2 },
    { _id: 'general', count: 3 },
  ],
  byRequestType: [
    { _id: 'valid', count: 8 },
    { _id: 'invalid', count: 2 },
    { _id: 'garbage', count: 2 },
  ],
};

const offlineWorkers = [
  {
    worker_id: 'WRK-001',
    name: 'Aman Singh',
    phone: '+91 9876543210',
    email: 'aman@example.com',
    departments: ['WATER', 'ROAD'],
    status: 'available',
    active_tasks: 2,
    completed_tasks: 14,
    rating: 4.8,
  },
  {
    worker_id: 'WRK-002',
    name: 'Sneha Rao',
    phone: '+91 9123456780',
    email: 'sneha@example.com',
    departments: ['GARBAGE', 'SANITATION'],
    status: 'busy',
    active_tasks: 4,
    completed_tasks: 9,
    rating: 4.6,
  },
];

const offlineNotifications = [
  {
    id: 'notif-1',
    title: 'Water maintenance notice',
    message: 'Scheduled repair in the east ward tonight.',
    status: 'sent',
    created_at: '2026-07-20T10:00:00.000Z',
  },
  {
    id: 'notif-2',
    title: 'Garbage pickup reminder',
    message: 'Collection will continue after 6 PM.',
    status: 'pending',
    created_at: '2026-07-20T09:30:00.000Z',
  },
];

const offlineSubmissions = [
  {
    id: 'sub-1',
    task_description: 'Cleared blocked drain near the market.',
    submission_notes: 'Completed by 4 PM and verified on site.',
    submitted_at: '2026-07-20T11:00:00.000Z',
    workers: { name: 'Sneha Rao', work_type: 'Sanitation' },
    video_url: '',
    document_url: '',
  },
];

export const getOfflinePayload = (endpoint) => {
  if (endpoint.includes('/dashboard/stats')) {
    return { data: { success: true, data: offlineStats } };
  }

  if (endpoint.includes('/tickets/')) {
    const ticketId = endpoint.split('/tickets/')[1].split('?')[0];
    const match = offlineTickets.find((ticket) =>
      ticket._id === ticketId || ticket.ticketId === ticketId || ticket.id === ticketId
    );
    return { data: { success: true, data: match || offlineTickets[0] } };
  }

  if (endpoint.includes('/tickets')) {
    return { data: { success: true, data: offlineTickets } };
  }

  if (endpoint.includes('/analysis/departments/stats')) {
    return { data: { success: true, data: offlineDepartmentStats } };
  }

  if (endpoint.includes('/workers')) {
    return { data: { success: true, data: offlineWorkers } };
  }

  if (endpoint.includes('/notifications/history')) {
    return { data: { success: true, notifications: offlineNotifications } };
  }

  if (endpoint.includes('/notifications/subscribers')) {
    return { data: { success: true, subscribers: { telegram: 42, whatsapp: 29, inApp: 87, total: 158 } } };
  }

  if (endpoint.includes('/workers/submissions/pending')) {
    return { data: { success: true, data: offlineSubmissions } };
  }

  return { data: { success: true, data: offlineTickets } };
};
