import type { AppNotice } from '@/types/notice';

import type { HttpClient } from './http-client';
import { toAppNotice, type ApiNotificacion } from './notice-mapper';

export type ApiNoticesService = {
  listNotices(): Promise<AppNotice[]>;
  getUnreadCount(): Promise<number>;
  markNoticeRead(noticeId: string): Promise<AppNotice>;
  markAllNoticesRead(): Promise<number>;
};

type ApiUnreadCount = { unread: number };

export function createApiNoticesService(http: HttpClient): ApiNoticesService {
  return {
    async listNotices(): Promise<AppNotice[]> {
      const rows = await http.request<ApiNotificacion[]>('/notificaciones');
      return rows.map(toAppNotice);
    },

    async getUnreadCount(): Promise<number> {
      const body = await http.request<ApiUnreadCount>('/notificaciones/no-leidas');
      return body.unread;
    },

    async markNoticeRead(noticeId: string): Promise<AppNotice> {
      const row = await http.request<ApiNotificacion>(
        `/notificaciones/${noticeId}/leida`,
        { method: 'PATCH' },
      );
      return toAppNotice(row);
    },

    /** `POST /notificaciones/leidas` answers with the resulting count, not the rows. */
    async markAllNoticesRead(): Promise<number> {
      const body = await http.request<ApiUnreadCount>('/notificaciones/leidas', {
        method: 'POST',
      });
      return body.unread;
    },
  };
}
