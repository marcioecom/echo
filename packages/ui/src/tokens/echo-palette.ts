/**
 * Echo green palette — hex source of truth for marketing and, later, the app.
 * CSS custom properties live in `packages/ui/src/styles/echo-palette.css`.
 * Do not map these onto dashboard `--primary` until that dedicated pass.
 */
export const echoGreen = {
  50: "#f6fdf0",
  100: "#e9f8dc",
  200: "#d5efbe",
  300: "#badf96",
  400: "#99c965",
  500: "#7fb042",
  600: "#61911c",
  700: "#446b00",
  800: "#2b4700",
  900: "#182a00",
} as const

export const echoPalette = {
  primary: echoGreen[400],
  primaryHover: "#85b749",
  primaryForeground: "#121c07",
  background: "#fcfff9",
  surface: "#ffffff",
  text: "#171914",
  textMuted: "#494f44",
  border: "#dae1d3",
  green: echoGreen,
} as const

export const echoPaletteOklch = {
  primary: "oklch(0.78 0.14 130)",
  primaryHover: "oklch(0.72 0.15 130)",
  primaryForeground: "oklch(0.21 0.04 130)",
  background: "oklch(0.995 0.008 130)",
  surface: "oklch(1 0 0)",
  text: "oklch(0.21 0.01 130)",
  textMuted: "oklch(0.42 0.02 130)",
  border: "oklch(0.90 0.02 130)",
  green: {
    50: "oklch(0.985 0.018 130)",
    100: "oklch(0.96 0.04 130)",
    200: "oklch(0.92 0.07 130)",
    300: "oklch(0.86 0.105 130)",
    400: "oklch(0.78 0.14 130)",
    500: "oklch(0.70 0.15 130)",
    600: "oklch(0.60 0.15 130)",
    700: "oklch(0.48 0.13 130)",
    800: "oklch(0.36 0.10 130)",
    900: "oklch(0.26 0.07 130)",
  },
} as const
