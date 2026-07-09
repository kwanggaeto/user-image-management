import type { ThumbnailGenerator } from "./types";

function blobToStream(input: Blob): ReadableStream<Uint8Array> {
  if (typeof input.stream === "function") {
    return input.stream();
  }

  const stream = new Response(input).body;
  if (!stream) {
    throw new Error("Unable to read image blob");
  }
  return stream;
}

export function createCloudflareThumbnailGenerator(
  images: ImagesBinding,
): ThumbnailGenerator {
  return {
    async generate(input: Blob): Promise<Blob> {
      const result = await images
        .input(blobToStream(input))
        .transform({ width: 240, height: 240, fit: "cover" })
        .output({ format: "image/webp", quality: 82, anim: false });
      const response = result.response();
      const blob = await response.blob();

      return blob.type === "image/webp"
        ? blob
        : new Blob([await blob.arrayBuffer()], { type: "image/webp" });
    },
  };
}
