// FILE: src/components/system/Modal.tsx
"use client";
import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";


type ModalProps = {
open: boolean;
onClose: () => void;
title?: string;
children?: React.ReactNode;
footer?: React.ReactNode;
};


export default function Modal({ open, onClose, title, children, footer }: ModalProps){
const labelId = useId();
const descId = useId();
const firstFocusRef = useRef<HTMLButtonElement>(null);
useEffect(() => {
if (!open) return;
const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
document.addEventListener("keydown", onKey);
const prev = document.activeElement as HTMLElement | null;
firstFocusRef.current?.focus();
document.body.style.overflow = "hidden";
return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; prev?.focus?.(); };
}, [open, onClose]);


if (typeof document === "undefined") return null;


return createPortal(
<>
<div className="modal-backdrop" data-open={open} onClick={onClose} />
<div className="modal" data-open={open} role="dialog" aria-modal="true" aria-labelledby={labelId} aria-describedby={descId}>
<div className="modal__panel">
<div className="modal__header">
<div id={labelId} className="modal__title">{title}</div>
<button ref={firstFocusRef} className="modal__close" aria-label="Tutup" onClick={onClose}>✕</button>
</div>
<div className="modal__body" id={descId}>{children}</div>
{footer && (<div className="modal__footer">{footer}</div>)}
</div>
</div>
</>,
document.body
);
}