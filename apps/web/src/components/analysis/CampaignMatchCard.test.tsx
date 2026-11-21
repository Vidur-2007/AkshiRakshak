import { render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeAll, describe, expect, it } from 'vitest';
import en from '@/locales/en.json';
import type { CampaignMatch } from '@/lib/campaignMatch';
import { categoryText } from '@/lib/engine';
import { initI18n } from '@/lib/i18n';
import { CampaignMatchCard } from './CampaignMatchCard';

beforeAll(async () => {
  await initI18n();
});

function show(match: CampaignMatch) {
  const router = createMemoryRouter(
    [{ path: '/', element: <CampaignMatchCard match={match} lang="en" /> }],
    { initialEntries: ['/'] },
  );
  render(<RouterProvider router={router} />);
}

const BASE: CampaignMatch = {
  category: 'fake_kyc',
  campaign: 'kyc-block-wave',
  shared: [
    { type: 'domain', value: 'sbi-kyc-update.xyz' },
    { type: 'phone', value: '+919876500001' },
  ],
  messages: 113,
  langs: 4,
  closest: { text: 'alert! sbi kyc pending', lang: 'en' },
};

describe('CampaignMatchCard', () => {
  it('shows the dataset count, the shared details, the closest example and the network link', () => {
    show(BASE);
    expect(screen.getByText('113')).toBeTruthy();
    const kind = categoryText('fake_kyc', 'en').name;
    expect(
      screen.getByText(en.campaign.count.replace('{{kind}}', kind).replace('{{langs}}', '4')),
    ).toBeTruthy();
    expect(
      screen.getByText(en.campaign.shares.replace('{{campaign}}', en.campaigns['kyc-block-wave'])),
    ).toBeTruthy();
    const shared = screen.getByRole('list', { name: en.campaign.sharedLabel });
    expect(
      within(shared)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['sbi-kyc-update.xyz', '+919876500001']);
    expect(screen.getByText('“alert! sbi kyc pending”')).toBeTruthy();
    const link = screen.getByRole('link', { name: en.campaign.seeNetwork });
    expect(link.getAttribute('href')).toBe('/network?category=fake_kyc');
    // always labelled as sample data, never as reports
    expect(screen.getByText(en.campaign.sample)).toBeTruthy();
    expect(screen.queryByText(/reported/i)).toBeNull();
  });

  it('says "looks like" without shared details, and drops the link without a campaign', () => {
    show({ ...BASE, shared: [], closest: null });
    expect(
      screen.getByText(
        en.campaign.looksLike.replace('{{campaign}}', en.campaigns['kyc-block-wave']),
      ),
    ).toBeTruthy();
    expect(screen.queryByText(en.campaign.closest)).toBeNull();
  });

  it('names only the kind of scam when no campaign has it, and still links to the wall', () => {
    show({ ...BASE, category: 'romance', campaign: null, shared: [] });
    const kind = categoryText('romance', 'en').name;
    expect(screen.getByText(en.campaign.knownKind.replace('{{kind}}', kind))).toBeTruthy();
    // the wall still has this kind of scam, so the link is there
    expect(screen.getByRole('link', { name: en.campaign.seeNetwork }).getAttribute('href')).toBe(
      '/network?category=romance',
    );
  });
});
