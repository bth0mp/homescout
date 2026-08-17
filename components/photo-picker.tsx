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
const MAX_DIMENSION = 1600;

/**
 * Shrink an oversized image in the browser before uploading.
 * Falls back to the original on any failure — a photo that will not decode here
 * is better sent as-is and rejected by server validation with a real message.
 */
async function downscale(file: File): Promise<File> {
  // Small enough already; leave it alone and keep its original format.
  if (file.size < 900_000) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const longest = Math.max(bitmap.width, bitmap.height);
    const scale = Math.min(1, MAX_DIMENSION / longest);

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);

    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob(res, "image/jpeg", 0.85),
    );
    if (!blob || blob.size >= file.size) return file;

    return new File([blob], "photo.jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

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

  function upload(original: File) {
    setError(null);
    start(async () => {
      // Phone photos are routinely 5-10MB and a listing screenshot is far
      // bigger than it needs to be. Downscaling here keeps uploads well under
      // any limit and keeps the SQLite file small enough that the one-file
      // backup stays practical.
      const file = await downscale(original);

      if (file.size > MAX_PHOTO_BYTES) {
        setError(`That image is ${(file.size / 1024 / 1024).toFixed(1)}MB; the limit is 5MB.`);
        return;
      }

      const fd = new FormData();
      fd.set("photo", file);
      try {
        const res = await savePhoto(propertyId, fd);
        if (!res.ok) setError(res.error);
        else setStamp(Date.now()); // bust the immutable cache
      } catch {
        // Never let a failed upload take the page down with it.
        setError("Upload failed. Try a smaller image, or use Choose file.");
      }
    });
  }

  // Listen on the document, not on the drop zone.
  //
  // A paste event only fires on the focused element, so a listener bound to the
  // zone required clicking it first — which nobody does, and which made Ctrl+V
  // look broken. Bound here it works the moment the page is open. A paste while
  // a text field is focused is left alone so pasting an address still works.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if (typing) return;

      const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith("image/"));
      const file = item?.getAsFile();
      if (file) {
        e.preventDefault();
        upload(file);
      }
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
    // upload closes over propertyId only.
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
            <p>Press Ctrl+V to paste an image, or drop one here.</p>
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
