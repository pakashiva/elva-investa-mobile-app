import { apiRequest } from '../lib/api';

export type NotificationKind =
  | 'investment'
  | 'withdrawal'
  | 'agreement_renewal'
  | 'loan';

export type InvestorNotification = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  decision: 'approved' | 'rejected' | 'recorded' | 'due' | 'overdue';
  referenceId: string | null;
  isRead: boolean;
  createdAt: string;
};

type NotificationRow = {
  id: string;
  kind: string;
  title: string;
  body: string;
  decision: string;
  referenceId?: string | null;
  reference_id?: string | null;
  isRead?: boolean;
  is_read?: boolean;
  createdAt?: string;
  created_at?: string;
};

export function mapNotificationKind(kind: string): NotificationKind {
  if (kind === 'withdrawal') return 'withdrawal';
  if (kind === 'agreement_renewal') return 'agreement_renewal';
  if (kind === 'loan') return 'loan';
  return 'investment';
}

function mapRow(row: NotificationRow): InvestorNotification {
  return {
    id: row.id,
    kind: mapNotificationKind(row.kind),
    title: row.title,
    body: row.body,
    decision: (['approved', 'rejected', 'recorded', 'due', 'overdue'].includes(row.decision) ? row.decision : 'approved') as InvestorNotification['decision'],
    referenceId: row.referenceId ?? row.reference_id ?? null,
    isRead: Boolean(row.isRead ?? row.is_read),
    createdAt: String(row.createdAt ?? row.created_at ?? ''),
  };
}

export async function getInvestorNotifications(
  _userId?: string
): Promise<InvestorNotification[]> {
  const data = await apiRequest<{ notifications: NotificationRow[] }>(
    '/api/mobile/notifications'
  );
  return (data.notifications ?? []).map(mapRow);
}

export async function getUnreadNotificationCount(
  _userId?: string
): Promise<number> {
  const data = await apiRequest<{ unreadCount: number }>(
    '/api/mobile/notifications/unread-count'
  );
  return Number(data.unreadCount ?? 0);
}

export async function markAllNotificationsRead(
  _userId?: string
): Promise<void> {
  await apiRequest('/api/mobile/notifications/read-all', { method: 'POST' });
}

export async function markNotificationRead(
  _userId: string,
  notificationId: string
): Promise<void> {
  await apiRequest(`/api/mobile/notifications/${notificationId}/read`, {
    method: 'POST',
  });
}

export async function getNotificationsCreatedAfter(
  _userId: string,
  sinceIso: string
): Promise<InvestorNotification[]> {
  const data = await apiRequest<{ notifications: NotificationRow[] }>(
    `/api/mobile/notifications?after=${encodeURIComponent(sinceIso)}`
  );
  return (data.notifications ?? []).map(mapRow);
}
