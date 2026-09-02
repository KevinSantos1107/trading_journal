const fs = require('fs');

// 1. UPDATE types.ts
let types = fs.readFileSync('src/lib/types.ts', 'utf-8');
types = types.replace(/technicalReading\?: string;/g, 'imageUrl?: string;');
fs.writeFileSync('src/lib/types.ts', types, 'utf-8');

// 2. UPDATE firestore.ts
let firestore = fs.readFileSync('src/lib/firestore.ts', 'utf-8');

const storageFunctions = `
export async function uploadTradeImage(file: File, tradeId: string | number): Promise<string> {
  const userId = await getCurrentUserId();
  const fileExt = file.name.split('.').pop();
  const fileName = \`\${tradeId}-\${Math.random().toString(36).substring(2)}.\${fileExt}\`;
  const filePath = \`\${userId}/\${fileName}\`;

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
`;

if (!firestore.includes('uploadTradeImage')) {
  firestore += '\n' + storageFunctions;
}

// Modify deleteTradeFromFirestore
const deleteTradeRegex = /export async function deleteTradeFromFirestore\(id: number\): Promise<void> \{\s*const userId = await getCurrentUserId\(\);\s*const \{ error \} = await supabase\.from\('trades'\)\.delete\(\)\.eq\('id', id\)\.eq\('user_id', userId\);\s*if \(error\) throw error;\s*\}/m;

const deleteTradeReplacement = `export async function deleteTradeFromFirestore(id: number): Promise<void> {
  const userId = await getCurrentUserId();
  
  const { data: trade } = await supabase.from('trades').select('details').eq('id', id).eq('user_id', userId).single();
  if (trade?.details?.imageUrl) {
     await deleteTradeImage(trade.details.imageUrl);
  }

  const { error } = await supabase.from('trades').delete().eq('id', id).eq('user_id', userId);
  if (error) throw error;
}`;

firestore = firestore.replace(deleteTradeRegex, deleteTradeReplacement);
fs.writeFileSync('src/lib/firestore.ts', firestore, 'utf-8');

console.log('types.ts and firestore.ts updated');