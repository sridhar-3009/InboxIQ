import Link from 'next/link';
import { Clock } from 'lucide-react';
import type { EmailDebt } from '@/lib/types';

interface EmailDebtWidgetProps {
  debts: EmailDebt[];
}

function firstName(name: string): string {
  return (name || '').split(' ')[0] || name;
}

export default function EmailDebtWidget({ debts }: EmailDebtWidgetProps) {
  if (debts.length === 0) return null;

  const top = debts.slice(0, 5);

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-1">
        <Clock className="h-4 w-4 text-primary-600" />
        <h3 className="font-serif text-lg text-gray-900 dark:text-gray-100">You owe these people a reply</h3>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Oldest un-replied emails that still need you.
      </p>
      <div className="space-y-2.5">
        {top.map((d) => (
          <Link
            key={d.email_id}
            href={`/email/${d.email_id}?reply=1`}
            className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 dark:border-gray-700 px-3.5 py-2.5 hover:border-primary-300 dark:hover:border-primary-700 hover:bg-primary-50/40 dark:hover:bg-primary-900/10 transition-colors"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                {firstName(d.contact_name)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{d.subject}</p>
            </div>
            <span
              className={
                d.days_owed >= 7
                  ? 'flex-shrink-0 text-xs font-semibold text-urgent bg-urgent/10 border border-urgent/30 rounded-full px-2.5 py-1'
                  : 'flex-shrink-0 text-xs font-semibold text-warning bg-warning/10 border border-warning/30 rounded-full px-2.5 py-1'
              }
            >
              {d.days_owed}d owed
            </span>
          </Link>
        ))}
      </div>
      {debts.length > top.length && (
        <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
          +{debts.length - top.length} more waiting on you
        </p>
      )}
    </div>
  );
}
