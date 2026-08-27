import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

export interface R2ObjectStoreConfig {
  endpoint: string
  bucket: string
  accessKeyId: string
  secretAccessKey: string
}

export interface ObjectHead {
  contentType: string | undefined
  contentLength: number | undefined
  etag: string | undefined
}

export interface ObjectGet {
  body: ReadableStream | undefined
  contentType: string | undefined
  contentLength: number | undefined
  etag: string | undefined
}

export interface R2ObjectStore {
  presignPut(input: {
    key: string
    contentType: string
    expiresIn: number
  }): Promise<{ url: string; headers: { "Content-Type": string } }>
  head(key: string): Promise<ObjectHead>
  copy(input: { sourceKey: string; destinationKey: string }): Promise<void>
  delete(key: string): Promise<void>
  get(key: string): Promise<ObjectGet>
}

export function createR2ObjectStore(
  config: R2ObjectStoreConfig
): R2ObjectStore {
  const client = new S3Client({
    region: "auto",
    endpoint: config.endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  })

  return {
    async presignPut(input) {
      const url = await getSignedUrl(
        client,
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: input.key,
          ContentType: input.contentType,
        }),
        { expiresIn: input.expiresIn }
      )
      return { url, headers: { "Content-Type": input.contentType } }
    },
    async head(key) {
      const result = await client.send(
        new HeadObjectCommand({ Bucket: config.bucket, Key: key })
      )
      return {
        contentType: result.ContentType,
        contentLength: result.ContentLength,
        etag: result.ETag,
      }
    },
    async copy({ sourceKey, destinationKey }) {
      await client.send(
        new CopyObjectCommand({
          Bucket: config.bucket,
          Key: destinationKey,
          CopySource: `${config.bucket}/${encodeURIComponent(sourceKey).replaceAll("%2F", "/")}`,
        })
      )
    },
    async delete(key) {
      await client.send(
        new DeleteObjectCommand({ Bucket: config.bucket, Key: key })
      )
    },
    async get(key) {
      const result = await client.send(
        new GetObjectCommand({ Bucket: config.bucket, Key: key })
      )
      return {
        body: result.Body?.transformToWebStream(),
        contentType: result.ContentType,
        contentLength: result.ContentLength,
        etag: result.ETag,
      }
    },
  }
}
