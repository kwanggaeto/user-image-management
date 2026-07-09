import { describe, expect, test, vi } from "vitest";
import { createCloudflareThumbnailGenerator } from "./cloudflare-thumbnail-generator";

describe("createCloudflareThumbnailGenerator", () => {
  test("uses the Images binding to create a 240px webp thumbnail", async () => {
    const source = new Blob(["source"], { type: "image/jpeg" });
    const response = new Response("thumb", {
      headers: { "Content-Type": "image/webp" },
    });
    const responseFn = vi.fn().mockReturnValue(response);
    const outputFn = vi.fn().mockResolvedValue({ response: responseFn });
    const transform = vi.fn().mockReturnValue({ output: outputFn });
    const input = vi.fn().mockReturnValue({ transform });
    const generator = createCloudflareThumbnailGenerator({
      input,
    } as unknown as ImagesBinding);

    const thumbnail = await generator.generate(source);

    expect(input).toHaveBeenCalledWith(expect.any(ReadableStream));
    expect(transform).toHaveBeenCalledWith({
      width: 240,
      height: 240,
      fit: "cover",
    });
    expect(outputFn).toHaveBeenCalledWith({
      format: "image/webp",
      quality: 82,
      anim: false,
    });
    await expect(
      new Response(thumbnail).text(),
    ).resolves.toBe("thumb");
    expect(thumbnail.type).toBe("image/webp");
  });
});
