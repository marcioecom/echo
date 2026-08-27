import { createR2ObjectStore } from "@workspace/object-storage"

import { env } from "@/config/env"

export const objectStore = createR2ObjectStore({
  endpoint: env.R2_ENDPOINT,
  bucket: env.R2_BUCKET_NAME,
  accessKeyId: env.R2_ACCESS_KEY_ID,
  secretAccessKey: env.R2_SECRET_ACCESS_KEY,
})
