import {
  AlertCircle,
  Bell,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileCheck2,
  FileSignature,
  Folder,
  FolderOpen,
  Globe,
  Inbox,
  Info,
  Lock,
  LogOut,
  MessagesSquare,
  Pencil,
  Plus,
  Scale,
  Send,
  ShieldCheck,
  Sparkles,
  Tag,
  Trash2,
  User,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react-native';

import { colors } from '../tokens/colors';

/**
 * Registry of the glyphs this app actually uses. Mediación substitutes Lucide
 * for the source design's (Iconify/web) icon delivery — see design-system
 * README. Extend this map when a new screen needs a glyph; keeps the icon set
 * finite and typo-proof instead of stringly-typed against the whole library.
 */
const ICONS = {
  'alert-circle': AlertCircle,
  bell: Bell,
  check: Check,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  clock: Clock,
  'file-check-2': FileCheck2,
  'file-signature': FileSignature,
  folder: Folder,
  'folder-open': FolderOpen,
  globe: Globe,
  inbox: Inbox,
  info: Info,
  lock: Lock,
  'log-out': LogOut,
  'messages-square': MessagesSquare,
  pencil: Pencil,
  plus: Plus,
  scale: Scale,
  send: Send,
  'shield-check': ShieldCheck,
  sparkles: Sparkles,
  tag: Tag,
  'trash-2': Trash2,
  user: User,
  wallet: Wallet,
  x: X,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

export type IconProps = {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
};

/** Icon glyph wrapper — the only place lucide-react-native is imported from. */
export function Icon({ name, size = 20, color = colors.ink, strokeWidth = 2 }: IconProps) {
  const Glyph = ICONS[name];
  return <Glyph size={size} color={color} strokeWidth={strokeWidth} />;
}
