import { defineConfig } from "tsup"

export default defineConfig({
  entry: {
    main: "src/main.ts",
    "provision-twilio-whatsapp":
      "src/modules/channel-connections/cli/provision-twilio-whatsapp.ts",
  },
  format: ["esm"],
  platform: "node",
  target: "node20",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  splitting: false,
})
