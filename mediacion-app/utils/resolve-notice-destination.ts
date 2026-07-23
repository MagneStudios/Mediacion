import type { Href } from 'expo-router';

import type { NoticeDestination } from '../types/notice';

/**
 * The only place a NoticeDestination becomes a real route. Every branch
 * targets one of the app's already-registered route shapes — never a raw
 * string assembled from fixture data, never an external URL. Returns null
 * for 'none' (nothing to navigate to).
 */
export function resolveNoticeDestination(destination: NoticeDestination): Href | null {
  switch (destination.type) {
    case 'case':
      return { pathname: '/case/[id]', params: { id: destination.caseId } };
    case 'negotiation':
      return { pathname: '/case/[id]/negotiation', params: { id: destination.caseId } };
    case 'agreement':
      return { pathname: '/case/[id]/agreement', params: { id: destination.caseId } };
    case 'signature':
      return { pathname: '/case/[id]/agreement/sign', params: { id: destination.caseId } };
    case 'activity':
      return '/notices/activity';
    case 'none':
      return null;
    default:
      return null;
  }
}
