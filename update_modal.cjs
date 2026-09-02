const fs = require('fs');
let code = fs.readFileSync('src/components/TradeEntryModal.tsx', 'utf-8');

// The new Uploader component
const newUploaderComponent = `
const optimizeImage = async (file: File): Promise<File> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const MAX_WIDTH = 2560;
        const MAX_HEIGHT = 2560;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height = Math.round((height *= MAX_WIDTH / width));
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width = Math.round((width *= MAX_HEIGHT / height));
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject('No canvas context');
        
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob((blob) => {
          if (!blob) return reject('Blob conversion failed');
          const newFileName = file.name.replace(/\\.[^/.]+$/, "") + ".webp";
          const newFile = new File([blob], newFileName, { type: 'image/webp' });
          resolve(newFile);
        }, 'image/webp', 0.85);
      };
      img.onerror = (e) => reject(e);
    };
    reader.onerror = (e) => reject(e);
  });
};

function TradePrintUploader({ imageUrl, onUpload, onRemove }: { imageUrl?: string, onUpload: (url: string) => void, onRemove: () => void }) {
  const [status, setStatus] = useState<'idle' | 'optimizing' | 'uploading'>('idle');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        const items = e.clipboardData?.items;
        let hasImage = false;
        if (items) {
          for (let i = 0; i < items.length; i++) {
            if (items[i].kind === 'file' && items[i].type.startsWith('image/')) hasImage = true;
          }
        }
        if (!hasImage) return; 
      }

      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].kind === 'file' && items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) {
            processFile(file);
            e.preventDefault();
          }
          return;
        }
      }
    };

    document.addEventListener('paste', handleGlobalPaste);
    return () => document.removeEventListener('paste', handleGlobalPaste);
  }, []);

  const processFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Selecione uma imagem válida (PNG, JPG, WEBP)');
      return;
    }
    // Pre-check for sanity (e.g. 50MB file might crash the browser optimization)
    if (file.size > 20 * 1024 * 1024) {
      alert('A imagem é excessivamente grande (maior que 20MB). Selecione um arquivo menor.');
      return;
    }

    try {
      setStatus('optimizing');
      const optimizedFile = await optimizeImage(file);
      
      setStatus('uploading');
      const tempId = Date.now();
      const url = await uploadTradeImage(optimizedFile, tempId);
      
      onUpload(url);
    } catch (error) {
      console.error(error);
      alert('Erro ao processar e enviar a imagem. Tente novamente.');
    } finally {
      setStatus('idle');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) processFile(file);
  };

  return (
    <section className="protocol-card print-card">
      <div className="side-label">PRINT DA OPERAÇÃO</div>
      
      {imageUrl ? (
        <div className="print-preview-container">
          <img src={imageUrl} alt="Print da Operação" className="print-preview-img" onClick={() => window.open(imageUrl, '_blank')} />
          <div className="print-actions">
            <button type="button" onClick={() => window.open(imageUrl, '_blank')}>🔍 Ampliar</button>
            <button type="button" onClick={onRemove} className="btn-remove">Substituir / Remover</button>
          </div>
        </div>
      ) : (
        <div 
          className={\`print-upload-zone \${isDragging ? 'dragging' : ''}\`}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => status === 'idle' && fileInputRef.current?.click()}
        >
          {status !== 'idle' ? (
             <div className="uploading-state">{status === 'optimizing' ? 'Otimizando imagem...' : 'Enviando imagem...'}</div>
          ) : (
            <>
              <div className="upload-icon">📷</div>
              <strong>Adicione o print da operação</strong>
              <span>Cole com Ctrl + V, arraste uma imagem ou clique para selecionar</span>
              <button type="button" className="outline-button upload-btn">Selecionar imagem</button>
            </>
          )}
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={(e) => { if(e.target.files?.[0]) processFile(e.target.files[0]); e.target.value = ''; }} 
            accept="image/png, image/jpeg, image/webp" 
            style={{display: 'none'}} 
          />
        </div>
      )}
    </section>
  );
}
`;

const oldUploaderRegex = /function TradePrintUploader\([\s\S]*?<\/section>\s*\n\s*\}/m;
code = code.replace(oldUploaderRegex, newUploaderComponent);

// Also need to make sure `useState` is imported if not already. It is imported at the top.
// Wait, the state variable inside TradePrintUploader uses 'useState' and 'useEffect' and 'useRef'.
code = code.replace(/const \[isUploading, setIsUploading\] = useState\(false\);/, ""); // just in case it matched wrongly

fs.writeFileSync('src/components/TradeEntryModal.tsx', code, 'utf-8');
console.log('TradeEntryModal updated with optimization.');