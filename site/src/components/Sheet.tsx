'use client';

import { useEffect, type ReactNode } from 'react';

/** Modal surface: a centred dialog or a side panel on wide screens, a bottom sheet on phones. */
export function Sheet({
  label,
  onClose,
  variant,
  children,
}: {
  label: string;
  onClose: () => void;
  variant: 'dialog' | 'panel';
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className={`sheet-layer sheet-${variant}`}>
      <button type="button" className="sheet-scrim" aria-label="Close" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label={label} className="sheet">
        <span className="sheet-grip" aria-hidden />
        {children}
      </div>
    </div>
  );
}
