const fs = require('fs');

let code = fs.readFileSync('src/components/TradeEntryModal.tsx', 'utf-8');

// The easiest way is to add useEffect to TradePrintUploader
const globalPasteEffect = `
  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      // Ignore if user is typing in a textarea or input (unless it's a file paste)
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
`;

// Insert it right after fileInputRef
code = code.replace(/const fileInputRef = useRef<HTMLInputElement>\(null\);/, "const fileInputRef = useRef<HTMLInputElement>(null);\n" + globalPasteEffect);

// And we need to import useEffect in TradePrintUploader
// Since the file might only import useRef, let's replace "import { useRef }" with "import { useRef, useEffect, useState }"
// But wait, the previous script injected "import { useRef } from 'react';\n"
// TradeEntryModal already imports useState.
code = code.replace(/import \{ useRef \} from 'react';/, "import { useRef, useEffect } from 'react';");

fs.writeFileSync('src/components/TradeEntryModal.tsx', code, 'utf-8');
console.log('Global paste effect added.');