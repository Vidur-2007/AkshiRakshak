import { useMemo } from 'react';
import { RouterProvider } from 'react-router';
import { createRouter } from './routes';

export default function App() {
  const router = useMemo(() => createRouter(), []);
  return <RouterProvider router={router} />;
}
