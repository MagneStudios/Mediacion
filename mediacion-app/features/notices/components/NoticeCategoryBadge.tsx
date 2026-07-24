import { Badge } from '../../../design-system/components/Badge';
import { Icon, type IconName } from '../../../design-system/components/Icon';
import { semanticColors } from '../../../design-system/tokens/colors';
import type { NoticeCategory } from '../../../types/notice';

const CATEGORY_ICON: Record<NoticeCategory, IconName> = {
  case: 'folder',
  invitation: 'send',
  proposal: 'file-check-2',
  response: 'check',
  round: 'clock',
  agreement: 'scale',
  signature: 'file-signature',
  mediator: 'user',
  deadline: 'alert-circle',
  institutional: 'info',
  system: 'bell',
};

export type NoticeCategoryBadgeProps = {
  category: NoticeCategory;
  label: string;
};

/** Small neutral category marker — never sage-tinted; sage is reserved for AI-assisted actions, not notices. */
export function NoticeCategoryBadge({ category, label }: NoticeCategoryBadgeProps) {
  return (
    <Badge variant="neutral" iconLeft={<Icon name={CATEGORY_ICON[category]} size={12} color={semanticColors.text.secondary} />}>
      {label}
    </Badge>
  );
}
