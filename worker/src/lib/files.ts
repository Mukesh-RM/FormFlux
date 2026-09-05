/** FormSubmit caps attachments at 10MB for the whole submission, not per file. */
export const MAX_TOTAL_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 10;

export function totalUploadBytes(files: File[]): number {
  return files.reduce((sum, file) => sum + file.size, 0);
}

function formatMb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export type StoredFile = {
  key: string;
  filename: string;
  contentType: string;
  size: number;
};

export function publicOrigin(envBaseUrl: string | undefined, requestUrl: string): string {
  const configured = envBaseUrl?.trim().replace(/\/$/, "");
  if (configured) return configured;
  return new URL(requestUrl).origin;
}

export function fileDownloadUrl(
  origin: string,
  formId: string,
  submissionId: string,
  filename: string,
): string {
  return `${origin.replace(/\/$/, "")}/files/${formId}/${submissionId}/${encodeURIComponent(filename)}`;
}

export function safeFilename(name: string): string {
  const base = name.replace(/\\/g, "/").split("/").pop() || "upload";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 180);
  return cleaned || "upload";
}

export function validateUploads(files: File[]): string | null {
  if (files.length > MAX_FILES) {
    return `Too many files. Maximum is ${MAX_FILES} per submission.`;
  }

  const total = totalUploadBytes(files);
  if (total > MAX_TOTAL_UPLOAD_BYTES) {
    return `Attachments total ${formatMb(total)}, which exceeds the ${formatMb(
      MAX_TOTAL_UPLOAD_BYTES,
    )} limit for a single submission.`;
  }

  return null;
}

export async function storeUploads(
  bucket: R2Bucket,
  formId: string,
  submissionId: string,
  files: File[],
): Promise<StoredFile[]> {
  const stored: StoredFile[] = [];
  const used = new Set<string>();

  for (const file of files) {
    let filename = safeFilename(file.name);
    if (used.has(filename)) {
      const suffix = crypto.randomUUID().slice(0, 8);
      const dot = filename.lastIndexOf(".");
      filename =
        dot > 0
          ? `${filename.slice(0, dot)}-${suffix}${filename.slice(dot)}`
          : `${filename}-${suffix}`;
    }
    used.add(filename);

    const key = `${formId}/${submissionId}/${filename}`;
    await bucket.put(key, await file.arrayBuffer(), {
      httpMetadata: {
        contentType: file.type || "application/octet-stream",
      },
    });
    stored.push({
      key,
      filename,
      contentType: file.type || "application/octet-stream",
      size: file.size,
    });
  }

  return stored;
}

export async function deleteStoredFiles(bucket: R2Bucket, keys: string[]): Promise<void> {
  await Promise.all(
    keys.map(async (key) => {
      try {
        await bucket.delete(key);
      } catch (error) {
        console.error("Failed to delete R2 object:", key, error);
      }
    }),
  );
}

export function filenameFromKey(key: string): string {
  const parts = key.split("/");
  return parts[parts.length - 1] || key;
}
