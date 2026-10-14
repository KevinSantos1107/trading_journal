import { BookOpen, Clock3, Plus, Trash2 } from 'lucide-react';
import type { Note } from '@/lib/types';
import { shortDate } from '@/lib/calc';

type LearningProps = {
  notes: Note[];
  onAdd: () => void;
  onDelete: (id: number) => void;
};

export default function Learning({ notes, onAdd, onDelete }: LearningProps) {
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow"><span className="green-dot" /> PROCESSO E EVOLUÇÃO</div>
          <h1>Aprendizado <span className="muted">/</span> Notas</h1>
          <p>Transforme cada sessão em uma decisão melhor para a próxima.</p>
        </div>
        <button className="primary-button" onClick={onAdd}><Plus size={16} /> Nova anotação</button>
      </div>
      <div className="learning-hero">
        <div className="learning-icon"><BookOpen size={23} /></div>
        <div>
          <span className="eyebrow">DIÁRIO DE PROCESSO</span>
          <h2>O que o mercado ensinou hoje?</h2>
          <p>Registre contexto, emoções e decisões. A consistência nasce da revisão.</p>
        </div>
        <div className="learning-stat"><strong>{notes.length}</strong><span>anotações registradas</span></div>
      </div>
      <div className="notes-grid">
        {notes.map((note) => (
          <article className="note-card" key={note.id}>
            <div className="note-top"><span className="note-tag">{note.tag}</span><span>{shortDate(note.date)}</span></div>
            <h3>{note.title}</h3>
            <p>{note.body}</p>
            <div className="note-footer"><span><Clock3 size={14} /> Revisão de sessão</span><button onClick={() => onDelete(note.id)}><Trash2 size={14} /></button></div>
          </article>
        ))}
        <button className="new-note-card" onClick={onAdd}><Plus size={22} /><strong>Adicionar anotação</strong><span>Uma ideia, uma lição ou um ajuste</span></button>
      </div>
    </>
  );
}
