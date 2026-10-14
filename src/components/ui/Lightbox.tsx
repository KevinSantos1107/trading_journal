import { useEffect } from 'react';

type Props = { src: string; onClose: () => void };

export default function Lightbox({ src, onClose }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);
  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <div className="lightbox-inner" onClick={e => e.stopPropagation()}>
        <img src={src} alt="Print da operação" />
      </div>
      <button className="lightbox-close" onClick={onClose}>×</button>
    </div>
  );
}
