import { NoticeCard, type NoticeCardProps } from './NoticeCard';

export type DeadlineNoticeCardProps = Omit<NoticeCardProps, 'emphasis'>;

/** Same NoticeCard, restrained warning-tinted border — never a bright alarm color, never conveyed by color alone (the "Importante" text label still carries the meaning). */
export function DeadlineNoticeCard(props: DeadlineNoticeCardProps) {
  return <NoticeCard {...props} emphasis="warning" />;
}
