import { Instrument_Serif } from "next/font/google"
import type { ReactNode } from "react"

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: "italic",
  variable: "--font-instrument-serif",
  display: "swap",
})

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return <div className={instrumentSerif.variable}>{children}</div>
}
