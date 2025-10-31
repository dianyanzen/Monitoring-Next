// FILE: src/components/ui/FaceCard.tsx
"use client";

type FaceCardProps = {
  faceBase64?: string | null;
  mime?: string | null;
  alt?: string;
};

export default function FaceCard({ faceBase64, mime = "image/jpeg", alt = "Foto WNI" }: FaceCardProps) {
  const hasImage = Boolean(faceBase64);
  const safeMime = !mime || mime.startsWith("application") ? "image/jpeg" : mime;
  const src = hasImage ? `data:${safeMime};base64,${faceBase64}` : "";

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl border border-white/10 bg-slate-800/40">
      {hasImage ? (
        <img src={src} alt={alt} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-xs text-slate-300">
          Tidak ada foto
        </div>
      )}
    </div>
  );
}