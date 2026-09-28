// Shared UI: Modal (no browser dialogs), Logo, Polaroid/Avatar, QR, two-tap ConfirmButton.
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import QRCode from 'qrcode';
import { initials } from '../lib/util';

export function Modal({ title, children, actions, onClose, wide, className = '' }: {
  title?: ReactNode; children?: ReactNode; actions?: ReactNode; onClose?: () => void; wide?: boolean; className?: string;
}) {
  useEffect(() => {
    if (!onClose) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    addEventListener('keydown', k); return () => removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="modal-ov" onPointerDown={e => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className={`modal ${wide ? 'wide' : ''} ${className}`}>
        {title && <h2>{title}</h2>}
        <div className="modal-body">{children}</div>
        {actions && <div className="modal-actions">{actions}</div>}
      </div>
    </div>
  );
}

export function Logo({ className = '' }: { className?: string }) {
  return <span className={`logo ${className}`}><span className="the">The</span><span className="hundred">HUNDRED</span></span>;
}

// deterministic small tilt per name so cards look hand-pinned but stay stable
export const tiltFor = (s: string, max = 2) => {
  let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
  return `${((Math.abs(h) % 100) / 100 * 2 - 1) * max}deg`;
};

export function Polaroid({ url, name, caption, className = '', clip, pin, tilt, style }: {
  url?: string | null; name: string; caption?: ReactNode; className?: string; clip?: boolean; pin?: boolean; tilt?: string; style?: CSSProperties;
}) {
  return (
    <div className={`polaroid ${clip ? 'clip' : ''} ${pin ? 'pin' : ''} ${className}`} style={{ ['--tilt' as any]: tilt ?? tiltFor(name), ...style }}>
      {url ? <img className="ph" src={url} alt={name} draggable={false} /> : <div className="ph blank">{initials(name)}</div>}
      {caption !== undefined && <div className="cap">{caption}</div>}
    </div>
  );
}

export function Avatar({ url, name, size, className = '' }: { url?: string | null; name: string; size?: number | string; className?: string }) {
  const style = size ? { width: size, height: size } : undefined;
  return url
    ? <img className={`avatar ${className}`} src={url} alt={name} style={style} draggable={false} />
    : <div className={`avatar avatar-blank ${className}`} style={style}>{initials(name)}</div>;
}

export function QR({ text, className }: { text: string; className?: string }) {
  const [src, setSrc] = useState('');
  useEffect(() => { QRCode.toDataURL(text, { margin: 1, width: 640, errorCorrectionLevel: 'M', color: { dark: '#0a0a0a', light: '#f4efe4' } }).then(setSrc).catch(() => setSrc('')); }, [text]);
  return src ? <img className={className} src={src} alt={text} /> : null;
}

/** Two-tap confirm for irreversible actions (drunk-proof, no dialogs). */
export function ConfirmButton({ children, confirmText = 'TAP AGAIN TO CONFIRM', onConfirm, className = '', disabled }: {
  children: ReactNode; confirmText?: string; onConfirm: () => void; className?: string; disabled?: boolean;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => { if (!armed) return; const t = setTimeout(() => setArmed(false), 4000); return () => clearTimeout(t); }, [armed]);
  return (
    <button className={`${className} ${armed ? 'armed' : ''}`} disabled={disabled}
      onClick={() => { if (armed) { setArmed(false); onConfirm(); } else setArmed(true); }}>
      {armed ? confirmText : children}
    </button>
  );
}
