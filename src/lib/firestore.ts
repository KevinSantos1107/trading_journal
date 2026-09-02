import { supabase } from './firebase';
import type { Trade, Note, PartialExecution } from './types';

async function getCurrentUserId(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Não autenticado');
  return session.user.id;
}

export async function fetchTrades(): Promise<Trade[]> {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('trades')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: Number(row.id),
    date: row.date,
    asset: row.asset,
    strategy: row.strategy,
    contracts: Number(row.contracts),
    points: Number(row.points),
    result: Number(row.result),
    stopLoss: row.stop_loss != null ? Number(row.stop_loss) : undefined,
    partials: (row.partials ?? []) as PartialExecution[],
    hadPartial: (row.partials ?? []).length > 0,
    partialPoints: (row.partials ?? [])[0]?.points,
    partialContracts: (row.partials ?? [])[0]?.contracts,
    hadAddition: row.had_addition ?? false,
    additionPoints: row.addition_points != null ? Number(row.addition_points) : undefined,
    additionContracts: row.addition_contracts != null ? Number(row.addition_contracts) : undefined,
    note: row.note ?? '',
    details: (row.details ?? {}) as Trade['details'],
  }));
}

export async function fetchNotes(): Promise<Note[]> {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: Number(row.id),
    date: row.date,
    title: row.title,
    body: row.body,
    tag: row.tag,
  }));
}

export async function saveTradeToFirestore(trade: Trade): Promise<void> {
  const userId = await getCurrentUserId();
  const { error } = await supabase.from('trades').upsert({
    id: trade.id,
    user_id: userId,
    date: trade.date,
    asset: trade.asset,
    strategy: trade.strategy,
    contracts: trade.contracts,
    points: trade.points,
    result: trade.result,
    stop_loss: trade.stopLoss ?? null,
    partials: trade.partials ?? [],
    had_addition: trade.hadAddition ?? false,
    addition_points: trade.additionPoints ?? null,
    addition_contracts: trade.additionContracts ?? null,
    note: trade.note ?? '',
    details: trade.details ?? {},
  });
  if (error) throw error;
}

export async function deleteTradeFromFirestore(id: number): Promise<void> {
  const userId = await getCurrentUserId();
  
  const { data: trade } = await supabase.from('trades').select('details').eq('id', id).eq('user_id', userId).single();
  if (trade?.details?.imageUrl) {
     await deleteTradeImage(trade.details.imageUrl);
  }

  const { error } = await supabase.from('trades').delete().eq('id', id).eq('user_id', userId);
  if (error) throw error;
}

export async function saveNoteToFirestore(note: Note): Promise<void> {
  const userId = await getCurrentUserId();
  const { error } = await supabase.from('notes').upsert({
    id: note.id,
    user_id: userId,
    date: note.date,
    title: note.title,
    body: note.body,
    tag: note.tag,
  });
  if (error) throw error;
}

export async function deleteNoteFromFirestore(id: number): Promise<void> {
  const userId = await getCurrentUserId();
  const { error } = await supabase.from('notes').delete().eq('id', id).eq('user_id', userId);
  if (error) throw error;
}

export async function cleanupOldTrades(): Promise<number> {
  return 0;
}

export async function deleteAllTrades(): Promise<void> {
  const userId = await getCurrentUserId();
  const { error } = await supabase.from('trades').delete().eq('user_id', userId);
  if (error) throw error;
}

export async function deleteAllNotes(): Promise<void> {
  const userId = await getCurrentUserId();
  const { error } = await supabase.from('notes').delete().eq('user_id', userId);
  if (error) throw error;
}


export async function uploadTradeImage(file: File, tradeId: string | number): Promise<string> {
  const userId = await getCurrentUserId();
  const fileExt = file.name.split('.').pop();
  const fileName = `${tradeId}-${Math.random().toString(36).substring(2)}.${fileExt}`;
  const filePath = `${userId}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('trade-prints')
    .upload(filePath, file);

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from('trade-prints').getPublicUrl(filePath);
  return data.publicUrl;
}

export async function deleteTradeImage(imageUrl: string): Promise<void> {
  try {
    const urlParts = imageUrl.split('/trade-prints/');
    if (urlParts.length === 2) {
      const filePath = urlParts[1];
      await supabase.storage.from('trade-prints').remove([filePath]);
    }
  } catch(e) {
    console.error('Erro ao deletar imagem', e);
  }
}
