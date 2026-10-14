import { useState } from 'react';
import type { FormEvent } from 'react';
import { Check, X } from 'lucide-react';
import type { Note } from '@/lib/types';

type Props = { onClose: () => void; onSave: (n: Note) => void };

export default function NoteModal({ onClose, onSave }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState<Note>({ id: Date.now(), date: today, title: '', body: '', tag: 'Disciplina' });
  const submit = (e: FormEvent) => { e.preventDefault(); onSave(form); };
  return (
    <div className="modal-backdrop">
      <form className="modal note-modal" onSubmit={submit}>
        <div className="modal-header">
          <div><span className="eyebrow">DIÁRIO DE PROCESSO</span><h2>Nova anotação</h2></div>
          <button type="button" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="form-grid">
          <label>Data<input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
          <label>Categoria<select value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value })}><option>Disciplina</option><option>Processo</option><option>Setup</option><option>Emoções</option></select></label>
          <label className="full-field">Título<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex: Esperar o segundo teste" required /></label>
          <label className="full-field">Anotação<textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="Escreva sua reflexão..." required /></label>
        </div>
        <div className="modal-actions">
          <button type="button" className="outline-button" onClick={onClose}>Cancelar</button>
          <button className="primary-button" type="submit"><Check size={16} /> Salvar anotação</button>
        </div>
      </form>
    </div>
  );
}
