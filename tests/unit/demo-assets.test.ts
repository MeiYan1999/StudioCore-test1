import { beforeAll, describe, expect, it } from "vitest";
import {
  generateDemoAlbumAssets,
  syncDemoAlbumAssetsToStore,
} from "@/lib/storage/local-storage";
import { DEMO_ALBUM, demoPhotoPreviewKey } from "@/lib/demo-album";

function memoryStore(initial: Record<string, Buffer> = {}) {
  const objects = new Map(Object.entries(initial));
  return {
    objects,
    async read(key: string) {
      const value = objects.get(key);
      if (!value) throw new Error("NoSuchKey");
      return value;
    },
    async put(key: string, buffer: Buffer) {
      objects.set(key, buffer);
    },
  };
}

describe("syncDemoAlbumAssetsToStore", () => {
  beforeAll(async () => {
    await generateDemoAlbumAssets();
  });

  it("uploads every missing demo original, thumbnail and preview", async () => {
    const store = memoryStore();
    const uploaded = await syncDemoAlbumAssetsToStore(store);
    expect(uploaded).toBe(DEMO_ALBUM.photos.length * 3);
    expect(store.objects.size).toBe(uploaded);
    expect(await syncDemoAlbumAssetsToStore(store)).toBe(0);
  });

  it("only uploads keys that are missing remotely", async () => {
    const store = memoryStore();
    await syncDemoAlbumAssetsToStore(store);
    const [photo] = DEMO_ALBUM.photos;
    const key = demoPhotoPreviewKey(photo.folder, photo.filename);
    store.objects.delete(key);
    expect(await syncDemoAlbumAssetsToStore(store)).toBe(1);
    expect(store.objects.has(key)).toBe(true);
  });
});
