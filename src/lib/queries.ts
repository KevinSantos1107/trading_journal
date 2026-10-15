/**
 * queries.ts
 * ──────────────────────────────────────────────────────────────────────────
 * Centraliza todos os hooks de dados do app usando TanStack Query.
 *
 * Benefícios:
 *  - Cache automático: dados não são rebuscados desnecessariamente ao trocar de aba
 *  - Background refetch: atualiza em segundo plano sem bloquear a UI
 *  - Stale-while-revalidate: exibe cache enquanto busca dados frescos
 *  - Estado de loading/error unificado
 *  - Mutations com invalidação de cache automática
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchTrades,
  fetchNotes,
  fetchOperationalConfig,
  saveTradeToFirestore,
  saveTradesBulkToFirestore,
  deleteTradeFromFirestore,
  saveNoteToFirestore,
  deleteNoteFromFirestore,
  saveOperationalConfig,
  deleteTradeImage,
} from './firestore';
import type { Trade, Note, OperationalConfig } from './types';
import { sortTradesChrono } from './calc';

// ── Query Keys ─────────────────────────────────────────────────────────────
// Centralizamos as keys para evitar typos e facilitar invalidações
export const QUERY_KEYS = {
  trades: (userId: string) => ['trades', userId] as const,
  notes: (userId: string) => ['notes', userId] as const,
  operationalConfig: (userId: string) => ['operationalConfig', userId] as const,
};

// ── Trades ─────────────────────────────────────────────────────────────────
export function useTrades(userId: string | undefined) {
  return useQuery({
    queryKey: userId ? QUERY_KEYS.trades(userId) : ['trades', 'unauthenticated'],
    queryFn: fetchTrades,
    enabled: !!userId,
    staleTime: 1000 * 60 * 2,       // Considera fresco por 2 minutos
    gcTime: 1000 * 60 * 10,         // Mantém em cache por 10 minutos
    select: (data) => sortTradesChrono(data),
  });
}

export function useSaveTrade(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (trade: Trade) => saveTradeToFirestore(trade),
    onSuccess: () => {
      if (userId) queryClient.invalidateQueries({ queryKey: QUERY_KEYS.trades(userId) });
    },
  });
}

export function useSaveTradesBulk(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (trades: Trade[]) => saveTradesBulkToFirestore(trades),
    onSuccess: () => {
      if (userId) queryClient.invalidateQueries({ queryKey: QUERY_KEYS.trades(userId) });
    },
  });
}

export function useDeleteTrade(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteTradeFromFirestore(id),
    onMutate: async (id: number) => {
      // Cancela qualquer refetch em andamento para evitar que sobrescreva o estado otimista
      if (userId) {
        await queryClient.cancelQueries({ queryKey: QUERY_KEYS.trades(userId) });
      }
      // Guarda snapshot para rollback em caso de erro
      const previousTrades = userId
        ? queryClient.getQueryData<Trade[]>(QUERY_KEYS.trades(userId))
        : undefined;
      // Aplica remoção imediata no cache
      if (userId) {
        queryClient.setQueryData<Trade[]>(QUERY_KEYS.trades(userId), (old = []) =>
          old.filter(t => t.id !== id)
        );
      }
      return { previousTrades };
    },
    onError: (_err, _id, context) => {
      // Reverte para o estado anterior se a mutação falhar
      if (userId && context?.previousTrades !== undefined) {
        queryClient.setQueryData(QUERY_KEYS.trades(userId), context.previousTrades);
      }
    },
    onSettled: () => {
      // Sincroniza com o banco após a mutação (sucesso ou erro)
      if (userId) queryClient.invalidateQueries({ queryKey: QUERY_KEYS.trades(userId) });
    },
  });
}

// ── Notes ──────────────────────────────────────────────────────────────────
export function useNotes(userId: string | undefined) {
  return useQuery({
    queryKey: userId ? QUERY_KEYS.notes(userId) : ['notes', 'unauthenticated'],
    queryFn: fetchNotes,
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,       // Notas mudam menos: fresco por 5 minutos
    gcTime: 1000 * 60 * 15,
    select: (data) => [...data].sort((a, b) => b.date.localeCompare(a.date)),
  });
}

export function useSaveNote(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (note: Note) => saveNoteToFirestore(note),
    onSuccess: () => {
      if (userId) queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notes(userId) });
    },
  });
}

export function useDeleteNote(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteNoteFromFirestore(id),
    onSuccess: () => {
      if (userId) queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notes(userId) });
    },
  });
}

// ── Operational Config ─────────────────────────────────────────────────────
export function useOperationalConfig(userId: string | undefined) {
  return useQuery({
    queryKey: userId ? QUERY_KEYS.operationalConfig(userId) : ['operationalConfig', 'unauthenticated'],
    queryFn: fetchOperationalConfig,
    enabled: !!userId,
    staleTime: 1000 * 60 * 10,      // Config raramente muda: fresco por 10 minutos
    gcTime: 1000 * 60 * 30,
  });
}

export function useSaveOperationalConfig(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (config: OperationalConfig) => saveOperationalConfig(config),
    onSuccess: () => {
      if (userId) queryClient.invalidateQueries({ queryKey: QUERY_KEYS.operationalConfig(userId) });
    },
  });
}

// ── Utility: invalidar tudo de um usuário (ex: no logout/login) ────────────
export function useInvalidateAll(userId: string | undefined) {
  const queryClient = useQueryClient();
  return () => {
    if (!userId) return;
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.trades(userId) });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notes(userId) });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.operationalConfig(userId) });
  };
}

// ── Helper: update cache localmente sem esperar o servidor ─────────────────
// Usado para deixar a UI instantânea (optimistic update)
export function useOptimisticTradeSave(userId: string | undefined) {
  const queryClient = useQueryClient();
  const key = userId ? QUERY_KEYS.trades(userId) : null;

  const applyLocally = (trade: Trade, isEdit: boolean) => {
    if (!key) return;
    queryClient.setQueryData<Trade[]>(key, (old = []) => {
      const updated = isEdit ? old.map(t => t.id === trade.id ? trade : t) : [...old, trade];
      return sortTradesChrono(updated);
    });
  };

  const removeLocally = (id: number) => {
    if (!key) return;
    queryClient.setQueryData<Trade[]>(key, (old = []) => old.filter(t => t.id !== id));
  };

  return { applyLocally, removeLocally };
}

export function useOptimisticNoteSave(userId: string | undefined) {
  const queryClient = useQueryClient();
  const key = userId ? QUERY_KEYS.notes(userId) : null;

  const applyLocally = (note: Note) => {
    if (!key) return;
    queryClient.setQueryData<Note[]>(key, (old = []) => [note, ...old.filter(n => n.id !== note.id)]);
  };

  const removeLocally = (id: number) => {
    if (!key) return;
    queryClient.setQueryData<Note[]>(key, (old = []) => old.filter(n => n.id !== id));
  };

  return { applyLocally, removeLocally };
}
