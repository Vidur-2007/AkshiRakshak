import { fireEvent, render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeAll, describe, expect, it } from 'vitest';
import en from '@/locales/en.json';
import { initI18n } from '@/lib/i18n';
import { DEFAULT_PREFS, useAppStore } from '@/lib/store';
import { routes } from '@/routes';
import { requestFor } from './QrLinkPage';
import { resolveMode } from './MessagesPage';

function open(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

const T = { timeout: 5000 };

beforeAll(() => {
  useAppStore.setState({ ...DEFAULT_PREFS, lang: 'en' });
  void initI18n();
});

describe('QR & links', () => {
  it('routes values to the right request', () => {
    expect(requestFor('upi://pay?pa=a@ybl', 'typed').core.kind).toBe('qr');
    expect(requestFor('https://x.xyz', 'qr')).toMatchObject({
      core: { kind: 'qr' },
      url: 'https://x.xyz',
    });
    expect(requestFor('refund.desk@ybl', 'typed').core).toMatchObject({
      kind: 'upi_id',
      upiId: 'refund.desk@ybl',
    });
    expect(requestFor('http://sbi-kyc.xyz/a', 'typed')).toMatchObject({
      core: { kind: 'url' },
      url: 'http://sbi-kyc.xyz/a',
    });
  });

  it('the Refund QR sample shows the QR x-ray with the UPI ID', async () => {
    open('/modules/qr-link');
    fireEvent.click(await screen.findByRole('button', { name: en.qrLink.samples.qr }, T));
    expect(await screen.findByText(en.xray.title, {}, T)).toBeTruthy();
    expect(screen.getAllByText('refund.desk@ybl').length).toBeGreaterThan(0);
  });

  it('?value= from an entity chip checks a link and shows its anatomy', async () => {
    open(`/modules/qr-link?value=${encodeURIComponent('http://sbi-kyc-update.xyz/verify')}`);
    expect(await screen.findByText(en.anatomy.title, {}, T)).toBeTruthy();
    expect(screen.getAllByText('sbi-kyc-update.xyz').length).toBeGreaterThan(0);
  });
});

describe('Collect-request guard', () => {
  it('updates the phone mock live and shows the PIN explainer when told they will receive', async () => {
    open('/modules/collect');
    const upi = await screen.findByLabelText(en.collect.upi, {}, T);
    fireEvent.change(upi, { target: { value: 'refund.desk@ybl' } });
    fireEvent.change(screen.getByLabelText(en.collect.amount), { target: { value: '4,999' } });
    const mock = screen.getByRole('figure', { name: en.collect.mockTitle });
    expect(within(mock).getByText('refund.desk@ybl')).toBeTruthy();
    expect(within(mock).getByText('₹4,999')).toBeTruthy();

    const receive = screen.getByRole('radiogroup', { name: en.collect.qReceive });
    fireEvent.click(within(receive).getByRole('radio', { name: en.collect.yes }));
    fireEvent.click(screen.getByRole('button', { name: en.collect.check }));

    expect(await screen.findByText(en.pin.title, {}, T)).toBeTruthy();
    expect(await screen.findByText(en.pin.final, {}, T)).toBeTruthy();
  });

  it('no PIN explainer for a known person who was not promising money', async () => {
    open('/modules/collect');
    const know = await screen.findByRole('radiogroup', { name: en.collect.qKnow }, T);
    fireEvent.click(within(know).getByRole('radio', { name: en.collect.yes }));
    fireEvent.click(
      within(screen.getByRole('radiogroup', { name: en.collect.qReceive })).getByRole('radio', {
        name: en.collect.no,
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: en.collect.check }));
    await screen.findByText(en.analysis.reasonsTitle, {}, T);
    expect(screen.queryByText(en.pin.title)).toBeNull();
  });
});

describe('Messages', () => {
  it('auto mode prefers email headers over chat-looking lines', () => {
    expect(resolveMode('From: a@b.xyz\nReply-To: c@d.com\nSubject: x\n\nhi', 'auto')).toBe('email');
    expect(resolveMode('hello', 'chat')).toBe('chat');
    expect(resolveMode('hello', 'auto')).toBe('message');
  });

  it('a pasted chat gets the risk line and the thread', async () => {
    open('/modules/messages');
    const area = await screen.findByLabelText(en.messages.inputLabel, {}, T);
    fireEvent.change(area, {
      target: {
        value:
          '[12/11/26, 10:01] Priya HR: Hello! Part-time job\n[12/11/26, 10:02] Me: what is the work\n[12/11/26, 10:05] Priya HR: Send OTP to verify your account',
      },
    });
    fireEvent.click(screen.getByRole('button', { name: en.messages.check }));
    expect(await screen.findByText(en.messages.riskLineTitle, {}, T)).toBeTruthy();
    expect(screen.getByText('Send OTP to verify your account')).toBeTruthy();
  });

  it('an email shows the header card with the Reply-To mismatch', async () => {
    open('/modules/messages');
    const area = await screen.findByLabelText(en.messages.inputLabel, {}, T);
    fireEvent.change(area, {
      target: {
        value:
          'From: "SBI Alerts" <alerts@sbi-secure-mail.xyz>\nReply-To: refund.desk@gmail.com\nSubject: Account blocked\n\nUpdate KYC now',
      },
    });
    fireEvent.click(screen.getByRole('button', { name: en.messages.check }));
    expect(await screen.findByText(en.messages.emailTitle, {}, T)).toBeTruthy();
    expect(
      screen.getByText(en.messages.replyMismatch.replace('{{domain}}', 'gmail.com')),
    ).toBeTruthy();
  });
});

describe('Screenshot flow from Quick Scan', () => {
  it('reads the screenshot on the device, then opens the analysis with the screenshot', async () => {
    const router = open('/scan');
    fireEvent.click(await screen.findByRole('button', { name: en.scan.uploadScreenshot }, T));
    const dialog = await screen.findByRole('dialog');
    const input = dialog.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File(['png'], 'shot.png', { type: 'image/png' })] },
    });
    // stub OCR returns a clear Telugu screenshot → straight to the analysis
    await screen.findByText(en.overlay.title, {}, T);
    expect(router.state.location.pathname).toMatch(/^\/scan\/.+/);
    expect(await screen.findByRole('img', { name: en.overlay.title })).toBeTruthy();
  });

  it('rejects non-images', async () => {
    open('/scan');
    fireEvent.click(await screen.findByRole('button', { name: en.scan.uploadScreenshot }, T));
    const dialog = await screen.findByRole('dialog');
    const input = dialog.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File(['%PDF'], 'a.pdf', { type: 'application/pdf' })] },
    });
    expect(await screen.findByText(en.shot.notImage)).toBeTruthy();
  });
});
