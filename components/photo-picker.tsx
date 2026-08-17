"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { removePhoto, savePhoto } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { MAX_PHOTO_BYTES } from "@/lib/image";

/**
 * Paste or pick a photo for a property.
 *
 * The fast path is paste: right-click the listing photo, Copy image, click here
 * and press Ctrl+V. HomeScout never fetches the listing itself — the bytes come
 * from your clipboard — and storing a copy means the picture survives the
 * listing being taken down when the house sells.
 */
export function PhotoPicker({
  propertyId,
  hasPhoto,
  nickname,
}: {
  propertyId: number;
  hasPhoto: boolean;
  nickname: string;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [stamp, setStamp] = useState(0);
  const zoneRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function upload(file: File) {
    setError(null);
    if (file.size > MAX_PHOTO_BYTES) {
      setError(`That image is ${(file.size / 1024 / 1024).toFixed(1)}MB; the limit is 5MB.`);
      return;
    }
    const fd = new FormData();
    fd.set("photo", file);
    start(async () => {
      const res = await savePhoto(propertyId, fd);
      if (!res.ok) setError(res.error);
      else setStamp(Date.now()); // bust the immutable cache
    });
  }

  // Paste anywhere inside the drop zone, and also when it holds focus.
  useEffect(() => {
    const el = zoneRef.current;
    if (!el) return;
    const onPaste = (e: ClipboardEvent) => {
      const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith("image/"));
      const file = item?.getAsFile();
      if (file) {
        e.preventDefault();
        upload(file);
      }
    };
    el.addEventListener("paste", onPaste);
    return () => el.removeEventListener("paste", onPaste);
    // upload is stable enough for this; propertyId is the only real dependency.
  }, [propertyId]);

  const src = `/api/photo/${propertyId}?v=${stamp || (hasPhoto ? 1 : 0)}`;

  return (
    <div className="grid gap-2">
      <div
        ref={zoneRef}
        tabIndex={0}
        role="group"
        aria-label="Property photo: paste or drop an image"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files?.[0];
          if (file) upload(file);
        }}
        className="border-border focus-visible:ring-ring grid min-h-40 place-items-center overflow-hidden rounded-lg border border-dashed p-3 focus-visible:ring-2 focus-visible:outline-none"
      >
        {hasPhoto || stamp ? (
          // eslint-disable-next-line @next/next/no-img-element -- served from our
          // own route as raw bytes; next/image would only add a resize pipeline.
          <img
            src={src}
            alt={`Photo of ${nickname}`}
            className="max-h-64 w-auto rounded-md object-contain"
          />
        ) : (
          <div className="text-muted-foreground space-y-1 text-center text-sm">
            <ImagePlus aria-hidden className="mx-auto size-6" />
            <p>Paste an image here (Ctrl+V), or drop one.</p>
            <p className="text-xs">
              Copy the photo from the listing in your browser, then paste. Up to 5MB.
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
            e.target.value = "";
          }}
        />
        <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => fileRef.current?.click()}>
          {pending ? "Saving…" : hasPhoto || stamp ? "Replace" : "Choose file"}
        </Button>
        {hasPhoto || stamp ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => start(async () => { await removePhoto(propertyId); setStamp(Date.now()); })}
          >
            <Trash2 aria-hidden className="size-3.5" />
            Remove
          </Button>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      ) : null}
    </div>
  );
}
