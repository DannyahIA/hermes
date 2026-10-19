'use client';

import { useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { FIELD_BASE_CLASSES } from '@/shared/constants/field-styles';
import { cn } from '@/shared/lib/cn';

interface CopyFieldProps {
  label: string;
  value: string;
  className?: string;
}

/**
 * A value to paste somewhere else, with a button that copies it. Outside
 * HTTPS (Hermes on the home network) the browser offers no clipboard; the
 * button then selects the text, ready for the system's copy.
 */
export function CopyField({ label, value, className }: CopyFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<'idle' | 'copied' | 'selected'>('idle');

  async function copy() {
    try {
      if (!navigator.clipboard) throw new Error('no clipboard');
      await navigator.clipboard.writeText(value);
      setState('copied');
    } catch {
      inputRef.current?.focus();
      inputRef.current?.select();
      setState('selected');
    }
  }

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex gap-2">
        <input
          ref={inputRef}
          readOnly
          aria-label={label}
          value={value}
          onFocus={(event) => event.currentTarget.select()}
          className={cn(FIELD_BASE_CLASSES, 'dimension-figure min-w-0 text-xs')}
        />
        <Button type="button" variant="outline" onClick={copy}>
          {state === 'copied' ? 'Copiado' : 'Copiar'}
        </Button>
      </div>
      <p aria-live="polite" className="text-muted-foreground text-xs">
        {state === 'selected' &&
          'Texto selecionado: use o copiar do sistema (Ctrl+C ou tocar e segurar).'}
      </p>
    </div>
  );
}
