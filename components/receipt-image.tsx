"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { API_BASE_URL } from "@/lib/api";

export function ReceiptImage({ url, token, onEnlarge }: { url: string; token: string; onEnlarge: (src: string) => void }) {
  const [imageUrl, setImageUrl] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (!url) return;
    let objectUrl = "";
    let cancelled = false;
    const source = /^https?:\/\//i.test(url) ? url : `${API_BASE_URL}${url.startsWith("/") ? url : `/${url}`}`;
    void fetch(source, { headers: { Authorization: `Bearer ${token}` } }).then(async (response) => {
      if (!response.ok) throw new Error(`Receipt could not be loaded (${response.status})`);
      const blob = await response.blob();
      if (!cancelled) { objectUrl = URL.createObjectURL(blob); setImageUrl(objectUrl); }
    }).catch((reason: Error) => { if (!cancelled) setError(reason.message); });
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [url, token]);
  if (error) return <Alert variant="destructive">{error}</Alert>;
  if (!imageUrl) return <div className="receipt-image-loading"><Skeleton />Loading receipt…</div>;
  // eslint-disable-next-line @next/next/no-img-element
  return <button type="button" className="receipt-preview-button" onClick={() => onEnlarge(imageUrl)} aria-label="Enlarge receipt image"><img src={imageUrl} alt="Petty cash receipt" /></button>;
}
