import type { Context } from "hono";

export type ParsedSubmission = {
  fields: Record<string, string>;
  files: File[];
};

export async function parseSubmission(c: Context): Promise<ParsedSubmission> {
  const contentType = c.req.header("Content-Type") || "";
  const fields: Record<string, string> = {};
  const files: File[] = [];

  if (
    contentType &&
    !contentType.includes("multipart/form-data") &&
    !contentType.includes("application/x-www-form-urlencoded")
  ) {
    console.warn("Unsupported Content-Type, attempting form parse anyway:", contentType);
  }

  const body = await c.req.parseBody({ all: true });
  for (const [key, value] of Object.entries(body)) {
    const items = Array.isArray(value) ? value : [value];
    const strings: string[] = [];

    for (const item of items) {
      if (item instanceof File) {
        if (item.size > 0 && item.name) files.push(item);
        continue;
      }
      if (typeof item === "string") strings.push(item);
    }

    if (strings.length > 0) {
      fields[key] = strings.join(", ");
    }
  }

  return { fields, files };
}
