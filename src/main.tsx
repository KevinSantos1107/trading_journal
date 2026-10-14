import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App.tsx';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Não re-busca ao focar a janela (usuário abre outra aba e volta)
      refetchOnWindowFocus: false,
      // Tenta 1 vez em caso de erro antes de mostrar mensagem
      retry: 1,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
          </QueryClientProvider>
  </StrictMode>
);

