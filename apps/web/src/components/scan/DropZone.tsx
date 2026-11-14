import { FileUp } from 'lucide-react';
import { AnimatePresence, m } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { transition } from '@/lib/motion';

export type DropPayload = { kind: 'text'; text: string } | { kind: 'image'; file: File };

const TEXT_FILE = /^text\/|\.txt$|\.eml$/i;

async function readDrop(dt: DataTransfer): Promise<DropPayload | null> {
  const file = dt.files[0];
  if (file) {
    if (file.type.startsWith('image/')) return { kind: 'image', file };
    if (TEXT_FILE.test(file.type) || TEXT_FILE.test(file.name)) {
      return { kind: 'text', text: (await file.text()).slice(0, 50_000) };
    }
    return null;
  }
  const text = dt.getData('text/plain') || dt.getData('text');
  return text ? { kind: 'text', text } : null;
}

/** Dragging a file anywhere on the page turns the whole viewport into a drop target (§5.2). */
export function DropZone({ onDrop }: { onDrop: (p: DropPayload) => void }) {
  const { t } = useTranslation();
  const [active, setActive] = useState(false);
  const depth = useRef(0);
  const handler = useRef(onDrop);
  handler.current = onDrop;

  useEffect(() => {
    const hasPayload = (e: DragEvent) =>
      !!e.dataTransfer &&
      [...e.dataTransfer.types].some((t) => t === 'Files' || t.startsWith('text'));
    const enter = (e: DragEvent) => {
      if (!hasPayload(e)) return;
      e.preventDefault();
      depth.current += 1;
      setActive(true);
    };
    const over = (e: DragEvent) => {
      if (hasPayload(e)) e.preventDefault();
    };
    const leave = () => {
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) setActive(false);
    };
    const drop = (e: DragEvent) => {
      if (!e.dataTransfer) return;
      e.preventDefault();
      depth.current = 0;
      setActive(false);
      void readDrop(e.dataTransfer).then((p) => p && handler.current(p));
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragover', over);
    window.addEventListener('dragleave', leave);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragover', over);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('drop', drop);
    };
  }, []);

  return (
    <AnimatePresence>
      {active && (
        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={transition.fast}
          className="pointer-events-none fixed inset-0 z-[70] grid place-items-center bg-bg/85 p-6"
          aria-hidden
        >
          <div className="flex h-full max-h-[32rem] w-full max-w-3xl flex-col items-center justify-center gap-3 rounded-sheet border-2 border-dashed border-brand/60 bg-brand/5 text-center">
            <FileUp className="size-10 text-brand" />
            <p className="text-xl font-semibold">{t('scan.dropTitle')}</p>
            <p className="text-text-2">{t('scan.dropHint')}</p>
          </div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
