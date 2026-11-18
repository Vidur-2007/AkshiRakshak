import {
  AtSign,
  Link2,
  Mail,
  MessageSquareText,
  MessagesSquare,
  Phone,
  QrCode,
  type LucideIcon,
} from 'lucide-react';
import { AnimatePresence, m } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { spring, transition } from '@/lib/motion';
import type { TextKind } from '@/lib/scan';

const KIND_ICON: Record<TextKind, LucideIcon> = {
  message: MessageSquareText,
  chat: MessagesSquare,
  email: Mail,
  url: Link2,
  upi_id: AtSign,
  phone: Phone,
  qr: QrCode,
};

/** Morphs between Message, Chat, Email, Link, UPI ID and Phone as the user types (§5.2). */
export function TypeDetectChip({ kind, visible }: { kind: TextKind; visible: boolean }) {
  const { t } = useTranslation();
  const Icon = KIND_ICON[kind];
  const label = t(`kind.${kind}`);
  return (
    <AnimatePresence initial={false}>
      {visible && (
        <m.span
          layout
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={spring.ui}
          aria-live="polite"
          aria-label={t('scan.detected', { kind: label })}
          className="inline-flex h-8 items-center gap-1.5 overflow-hidden rounded-full border border-brand/30 bg-brand/10 px-3 text-sm font-medium text-brand"
        >
          <AnimatePresence mode="popLayout" initial={false}>
            <m.span
              key={kind}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={transition.fast}
              className="inline-flex items-center gap-1.5"
            >
              <Icon className="size-3.5" aria-hidden />
              {label}
            </m.span>
          </AnimatePresence>
        </m.span>
      )}
    </AnimatePresence>
  );
}
