import { lazy } from 'react';
import { createBrowserRouter, type RouteObject } from 'react-router';
import { AppShell } from '@/components/shell/AppShell';

// One lazy chunk per page (SPEC_B_WEB.md §7).
const LandingPage = lazy(() => import('@/pages/LandingPage'));
const ScanPage = lazy(() => import('@/pages/ScanPage'));
const AnalysisPage = lazy(() => import('@/pages/AnalysisPage'));
const CollectPage = lazy(() => import('@/pages/CollectPage'));
const MessagesPage = lazy(() => import('@/pages/MessagesPage'));
const TransactionsPage = lazy(() => import('@/pages/TransactionsPage'));
const QrLinkPage = lazy(() => import('@/pages/QrLinkPage'));
const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const NetworkPage = lazy(() => import('@/pages/NetworkPage'));
const SosPage = lazy(() => import('@/pages/SosPage'));
const SosReportPage = lazy(() => import('@/pages/SosReportPage'));
const DojoListPage = lazy(() => import('@/pages/DojoListPage'));
const DojoPlayerPage = lazy(() => import('@/pages/DojoPlayerPage'));
const AskPage = lazy(() => import('@/pages/AskPage'));
const ProofPage = lazy(() => import('@/pages/ProofPage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));
const ShareTargetPage = lazy(() => import('@/pages/ShareTargetPage'));
const TourPage = lazy(() => import('@/pages/TourPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));

/** Every route from SPEC_B_WEB.md §4.1. */
export const ROUTE_PATHS = [
  '/',
  '/scan',
  '/scan/:id',
  '/modules/collect',
  '/modules/messages',
  '/modules/transactions',
  '/modules/qr-link',
  '/dashboard',
  '/network',
  '/sos',
  '/sos/report',
  '/learn/dojo',
  '/learn/dojo/:id',
  '/learn/ask',
  '/proof',
  '/settings',
  '/share-target',
  '/tour',
] as const;

export const routes: RouteObject[] = [
  {
    element: <AppShell />,
    children: [
      { index: true, element: <LandingPage /> },
      { path: 'scan', element: <ScanPage /> },
      { path: 'scan/:id', element: <AnalysisPage /> },
      { path: 'modules/collect', element: <CollectPage /> },
      { path: 'modules/messages', element: <MessagesPage /> },
      { path: 'modules/transactions', element: <TransactionsPage /> },
      { path: 'modules/qr-link', element: <QrLinkPage /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'network', element: <NetworkPage /> },
      { path: 'sos', element: <SosPage /> },
      { path: 'sos/report', element: <SosReportPage /> },
      { path: 'learn/dojo', element: <DojoListPage /> },
      { path: 'learn/dojo/:id', element: <DojoPlayerPage /> },
      { path: 'learn/ask', element: <AskPage /> },
      { path: 'proof', element: <ProofPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'share-target', element: <ShareTargetPage /> },
      { path: 'tour', element: <TourPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];

export function createRouter() {
  return createBrowserRouter(routes);
}
