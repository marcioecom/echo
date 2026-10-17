import { config } from "@workspace/eslint-config/base"

export default [
  ...config,
  {
    files: ["src/modules/sessions/lifecycle.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**"],
              message: "The session lifecycle reducer must remain import-free.",
            },
          ],
        },
      ],
    },
  },
]
