import clsx from 'clsx';
import {
  AlertCircle,
  MessageSquare,
  Clock,
  Info,
  Mail,
  AlertTriangle,
  Tag,
} from 'lucide-react';
import type { EmailCategory } from '@/lib/types';

interface CategoryBadgeProps {
  category: EmailCategory;
  size?: 'sm' | 'md';
}

const categoryConfig: Record<
  EmailCategory,
  { label: string; classes: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  urgent: {
    label: 'Urgent',
    classes: 'bg-urgent/10 dark:bg-urgent/20 text-urgent dark:text-red-300 border border-urgent/30 dark:border-urgent/40',
    Icon: AlertCircle,
  },
  needs_response: {
    label: 'Needs Response',
    classes: 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-800',
    Icon: MessageSquare,
  },
  follow_up: {
    label: 'Follow Up',
    classes: 'bg-warning/10 dark:bg-warning/20 text-warning dark:text-amber-300 border border-warning/30 dark:border-warning/40',
    Icon: Clock,
  },
  fyi: {
    label: 'FYI',
    classes: 'bg-olive-50 dark:bg-olive-600/20 text-olive-600 dark:text-olive-400 border border-olive-100 dark:border-olive-600/40',
    Icon: Info,
  },
  newsletter: {
    label: 'Newsletter',
    classes: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600',
    Icon: Mail,
  },
  spam: {
    label: 'Spam',
    classes: 'bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-800',
    Icon: AlertTriangle,
  },
  other: {
    label: 'Other',
    classes: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600',
    Icon: Tag,
  },
};

export default function CategoryBadge({ category, size = 'md' }: CategoryBadgeProps) {
  const config = categoryConfig[category] ?? categoryConfig.other;
  const { Icon } = config;

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full font-medium',
        config.classes,
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'
      )}
    >
      <Icon className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
      {config.label}
    </span>
  );
}
