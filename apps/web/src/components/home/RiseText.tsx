import { useEffect, useRef, useState, type ReactNode } from 'react';

const LATIN_ONLY = /^[\p{Script=Latin}\p{P}\p{N}\p{S}\s]*$/u;

export interface RisePart {
  t: string;
  em?: boolean;
}

/**
 * Letters rise into place, line by line, the first time the text is on screen (the design's
 * rise.js effect, in CSS: no animation library). Screen readers get the plain text once; the
 * letters are decorative. Reduced motion and Elder mode show the text at once (home.css).
 */
export function RiseText({
  lines,
  className,
  lineClassName,
  delay = 0,
}: {
  lines: RisePart[][];
  className?: string;
  /** class per line, e.g. ['a', 'b'] for the hero's two colours */
  lineClassName?: string[];
  /** extra delay before the first line, ms */
  delay?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const plain = lines.map((l) => l.map((p) => p.t).join('')).join(' ');
  // Latin text rises letter by letter; Indic scripts rise word by word, because splitting a word
  // into separate boxes would break its joined letters (conjuncts and vowel signs).
  const byLetter = LATIN_ONLY.test(plain);
  let n = 0;
  return (
    <span ref={ref} className={`rise ${className ?? ''}`} data-shown={shown ? 'yes' : 'no'}>
      <span className="sr-only">{plain}</span>
      <span aria-hidden>
        {lines.map((parts, li) => (
          <span key={li} className={`ln ${lineClassName?.[li] ?? ''}`}>
            {parts.map((part, pi) => {
              const words = part.t.split(/(\s+)/);
              const content: ReactNode[] = words.map((w, wi) => {
                if (/^\s+$/.test(w)) return ' ';
                if (!w) return null;
                if (!byLetter) {
                  const d = delay + li * 160 + n++ * 70;
                  return (
                    <span key={wi} className="w ch" style={{ transitionDelay: `${d}ms` }}>
                      {w}
                    </span>
                  );
                }
                return (
                  <span key={wi} className="w">
                    {[...w].map((ch, ci) => {
                      const d = delay + li * 160 + n++ * 30;
                      return (
                        <span key={ci} className="ch" style={{ transitionDelay: `${d}ms` }}>
                          {ch}
                        </span>
                      );
                    })}
                  </span>
                );
              });
              return part.em ? <em key={pi}>{content}</em> : <span key={pi}>{content}</span>;
            })}
          </span>
        ))}
      </span>
    </span>
  );
}
