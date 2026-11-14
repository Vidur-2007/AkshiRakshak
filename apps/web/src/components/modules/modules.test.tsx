import { fireEvent, render, screen, within } from '@testing-library/react';
import { LazyMotion, MotionConfig } from 'motion/react';
import type { ReactNode } from 'react';
import { beforeAll, describe, expect, it } from 'vitest';
import { RevealProvider } from '@/components/analysis/reveal';
import { flaggedBoxes, boxStyle, ScreenshotOverlay } from '@/components/analysis/ScreenshotOverlay';
import en from '@/locales/en.json';
import { analyze, parseUpiUri, type ChatTurnRisk, type UrlFinding } from '@/lib/engine';
import { initI18n } from '@/lib/i18n';
import { loadMotionFeatures } from '@/lib/motion';
import { useAppStore } from '@/lib/store';
import { ChatThreadView, EmailHeaderCard, RiskLine, riskLinePoints } from './ChatViews';
import { ageTone, DomainAgeBadge, RedirectHops } from './LinkExtras';
import { balanceAfter, PinPadExplainer } from './PinPadExplainer';
import { QRXray } from './QRXray';
import { URLAnatomy } from './URLAnatomy';

function wrap(ui: ReactNode) {
  return render(
    <LazyMotion features={loadMotionFeatures} strict>
      <MotionConfig reducedMotion="always">
        <RevealProvider>{ui}</RevealProvider>
      </MotionConfig>
    </LazyMotion>,
  );
}

beforeAll(() => {
  useAppStore.setState({ lang: 'en', elderMode: false });
  void initI18n();
});

const finding = (over: Partial<UrlFinding>): UrlFinding => ({
  raw: 'http://sbl.co.in/login',
  normalized: 'http://sbl.co.in/login',
  host: 'sbl.co.in',
  registrableDomain: 'sbl.co.in',
  tld: 'in',
  risk: 90,
  flags: ['LOOKALIKE_DOMAIN'],
  isOfficial: false,
  isShortener: false,
  isApk: false,
  ...over,
});

describe('QRXray', () => {
  it('shows payee, UPI ID with its app, prefilled amount and note', () => {
    wrap(
      <QRXray
        payload={parseUpiUri('upi://pay?pa=refund.desk@ybl&pn=SBI%20Refund&am=4999&tn=Refund')}
      />,
    );
    expect(screen.getByText('refund.desk@ybl')).toBeTruthy();
    expect(screen.getByText('PhonePe')).toBeTruthy();
    expect(screen.getByText('₹4,999')).toBeTruthy();
    expect(screen.getByText(en.xray.prefilled)).toBeTruthy();
    expect(screen.getByText(en.xray.payWarning)).toBeTruthy();
  });

  it('warns when the QR opens a website instead of a payment', () => {
    wrap(<QRXray payload={parseUpiUri('https://sbi-kyc-update.xyz/pay')} />);
    expect(screen.getByText(en.xray.opensWebsite)).toBeTruthy();
    expect(screen.queryByText(en.xray.payee)).toBeNull();
  });
});

describe('URLAnatomy', () => {
  it('splits the URL and shows the lookalike row with the diff marked', () => {
    const { container } = wrap(
      <URLAnatomy
        finding={finding({
          lookalikeOf: 'sbi.co.in',
          lookalikeDiff: [{ index: 2, expected: 'i', actual: 'l' }],
        })}
      />,
    );
    expect(screen.getByText('sbl.co.in')).toBeTruthy();
    expect(
      screen.getByText(en.anatomy.lookalikeOf.replace('{{domain}}', 'sbi.co.in')),
    ).toBeTruthy();
    const marked = [...container.querySelectorAll('.text-risk-scam')].map((n) => n.textContent);
    expect(marked).toContain('l');
    expect(screen.getByText(en.anatomy.insecure)).toBeTruthy();
  });

  it('explains the @ trick and marks official domains', () => {
    wrap(
      <URLAnatomy
        finding={finding({
          raw: 'https://www.sbi.co.in@evil.xyz/x',
          normalized: 'https://www.sbi.co.in@evil.xyz/x',
          registrableDomain: 'evil.xyz',
        })}
      />,
    );
    expect(screen.getByText(en.anatomy.userinfoNote)).toBeTruthy();
    expect(screen.getByText('evil.xyz')).toBeTruthy();
  });
});

describe('link extras', () => {
  it('lists redirect hops and emphasises the final domain', () => {
    wrap(
      <RedirectHops
        chain={{
          hops: [
            { url: 'https://bit.ly/x', status: 301 },
            { url: 'https://t.co/y', status: 302 },
          ],
          finalUrl: 'https://sbi-kyc.xyz/login',
          truncated: false,
        }}
      />,
    );
    expect(screen.getByText('301')).toBeTruthy();
    expect(screen.getByText('sbi-kyc.xyz').tagName).toBe('STRONG');
  });

  it('colours domain age by threshold', () => {
    expect(ageTone(4)).toBe('scam');
    expect(ageTone(60)).toBe('warn');
    expect(ageTone(400)).toBe('neutral');
    expect(ageTone(undefined)).toBe('neutral');
    wrap(<DomainAgeBadge age={{ domain: 'x.xyz', ageDays: 4 }} />);
    expect(screen.getByText('Registered 4 days ago')).toBeTruthy();
  });

  it('says age unavailable on error', () => {
    wrap(<DomainAgeBadge age={{ domain: 'x.xyz', error: 'timeout' }} />);
    expect(screen.getByText(en.age.unavailable)).toBeTruthy();
  });
});

describe('PinPadExplainer', () => {
  it('moves the amount out in equal parts', () => {
    expect(balanceAfter(24500, 5000, 0)).toBe(24500);
    expect(balanceAfter(24500, 5000, 2)).toBe(22000);
    expect(balanceAfter(24500, 5000, 4)).toBe(19500);
    expect(balanceAfter(1000, 5000, 4)).toBe(0);
  });

  it('shows the final state and the rule at once with reduced motion', () => {
    wrap(<PinPadExplainer amount={4999} requesterName="SBI Refund" />);
    expect(screen.getByText(en.pin.final)).toBeTruthy();
    expect(screen.getByText('₹19,501')).toBeTruthy();
    expect(screen.getByRole('button', { name: en.pin.replay })).toBeTruthy();
  });
});

describe('chat and email views', () => {
  const turns: ChatTurnRisk[] = [
    {
      index: 0,
      sender: 'them',
      text: '[12/11/26, 10:01] Priya HR: Hello, part-time job',
      risk: 5,
      start: 0,
      end: 10,
    },
    {
      index: 1,
      sender: 'me',
      text: '[12/11/26, 10:02] Me: what work',
      risk: 5,
      start: 11,
      end: 20,
    },
    {
      index: 2,
      sender: 'them',
      text: '[12/11/26, 10:05] Priya HR: Send OTP to verify',
      risk: 70,
      start: 21,
      end: 40,
    },
  ];

  it('renders bubbles without prefixes and marks the escalation', () => {
    wrap(<ChatThreadView turns={turns} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByText('Send OTP to verify')).toBeTruthy();
    expect(screen.getByText(en.messages.escalation)).toBeTruthy();
  });

  it('plots one point per message with the risk axis inverted', () => {
    const pts = riskLinePoints([0, 100]);
    expect(pts[0]!.y).toBeGreaterThan(pts[1]!.y);
    expect(pts[0]!.x).toBeLessThan(pts[1]!.x);
    const { container } = wrap(<RiskLine turns={turns} />);
    expect(container.querySelectorAll('circle')).toHaveLength(3);
    expect(screen.getByRole('img', { name: en.messages.riskLineLabel })).toBeTruthy();
  });

  it('highlights a Reply-To on another domain', () => {
    wrap(
      <EmailHeaderCard
        text={'From: SBI <alerts@sbi-mail.xyz>\nReply-To: help@gmail.com\nSubject: Blocked\n\nbody'}
      />,
    );
    expect(
      screen.getByText(en.messages.replyMismatch.replace('{{domain}}', 'gmail.com')),
    ).toBeTruthy();
  });
});

describe('ScreenshotOverlay', () => {
  it('draws only flagged boxes, strongest first, with popovers', async () => {
    const base = await analyze({
      kind: 'message',
      text: 'Your account will be BLOCKED today',
      lang: 'en',
    });
    const top = base.signals[0]!;
    const result = {
      ...base,
      kind: 'image' as const,
      image: {
        width: 1000,
        height: 500,
        boxes: [
          { text: 'Your', x: 0, y: 0, w: 100, h: 50, start: 0, end: 4, signalIds: [] },
          {
            text: 'BLOCKED',
            x: 500,
            y: 100,
            w: 200,
            h: 50,
            start: 25,
            end: 32,
            signalIds: [top.id],
          },
        ],
      },
    };
    expect(flaggedBoxes(result)).toHaveLength(1);
    expect(boxStyle({ x: 500, y: 100, w: 200, h: 50 }, 1000, 500)).toEqual({
      left: '50%',
      top: '20%',
      width: '20%',
      height: '10%',
    });
    wrap(<ScreenshotOverlay result={result} image={new Blob(['x'], { type: 'image/png' })} />);
    const box = await screen.findByRole('button', {
      name: en.overlay.box.replace('{{text}}', 'BLOCKED'),
    });
    fireEvent.click(box);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(top.label)).toBeTruthy();
  });
});
