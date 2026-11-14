import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { router } from '@/router/router';
import { queryClient } from '@/services/queryClient';
import { FORMAT_LOCALE } from '@/i18n';
import '@/styles/tokens.css';

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>,
  );
  document.documentElement.lang = FORMAT_LOCALE;
}
