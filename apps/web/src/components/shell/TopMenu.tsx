import { ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { linkBase } from './linkBase';
import type { NavItem } from './nav';

/** Desktop Modules / Learn menu (Radix dropdown), loaded right after first paint. */
export default function TopMenu({
  label,
  items,
  active,
}: {
  label: string;
  items: NavItem[];
  active: boolean;
}) {
  const { t } = useTranslation();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          linkBase,
          'data-[state=open]:bg-overlay/8 data-[state=open]:text-text',
          active ? 'bg-overlay/8 text-text' : 'text-text-2 hover:text-text',
        )}
      >
        {label}
        <ChevronDown className="size-3.5 opacity-70" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-80">
        {items.map((item) => (
          <DropdownMenuItem key={item.to} asChild>
            <Link to={item.to}>
              <item.icon aria-hidden />
              <span className="flex flex-col">
                <span className="font-medium text-text">{t(`nav.${item.key}`)}</span>
                {item.descKey && (
                  <span className="text-xs text-text-2">{t(`navDesc.${item.descKey}`)}</span>
                )}
              </span>
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
