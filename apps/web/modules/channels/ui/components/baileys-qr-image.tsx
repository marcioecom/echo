"use client"

import { toDataURL } from "qrcode"
import { useEffect, useState } from "react"

export function BaileysQrImage({ alt, value }: { alt: string; value: string }) {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    toDataURL(value, { margin: 1, width: 240 }).then((url) => {
      if (!cancelled) setSrc(url)
    })
    return () => {
      cancelled = true
    }
  }, [value])

  if (!src) return null
  return (
    <img
      alt={alt}
      className="size-60 rounded-md border bg-white p-2"
      src={src}
    />
  )
}
