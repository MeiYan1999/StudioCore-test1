export const DEMO_ALBUM = {
  id: "album-demo-01",
  title: "Album Cưới Demo",
  token: "demo-share-album-01",
  driveFolderId: "demo-folder-1",
  sourceUrl: "https://drive.google.com/drive/folders/demo-folder-1",
  selectionLimit: 5,
  extraPhotoPrice: 150000,
  folders: [
    { key: "duoi-ca", name: "Đuôi cá", externalId: "demo-folder-duoi-ca" },
    { key: "truyen-thong", name: "Truyền thống", externalId: "demo-folder-truyen-thong" },
    { key: "le-gia-tien", name: "Lễ gia tiên", externalId: "demo-folder-le-gia-tien" },
  ],
  photos: [
    { code: "ANH-001", folder: "duoi-ca", filename: "anh-001.jpg", isRaw: false },
    { code: "ANH-002", folder: "duoi-ca", filename: "anh-002.jpg", isRaw: false },
    { code: "ANH-003", folder: "duoi-ca", filename: "anh-003.jpg", isRaw: true },
    { code: "ANH-004", folder: "duoi-ca", filename: "anh-004.jpg", isRaw: false },
    { code: "ANH-005", folder: "truyen-thong", filename: "anh-005.jpg", isRaw: false },
    { code: "ANH-006", folder: "truyen-thong", filename: "anh-006.jpg", isRaw: false },
    { code: "ANH-007", folder: "truyen-thong", filename: "anh-007.jpg", isRaw: true },
    { code: "ANH-008", folder: "truyen-thong", filename: "anh-008.jpg", isRaw: false },
    { code: "ANH-009", folder: "le-gia-tien", filename: "anh-009.jpg", isRaw: false },
    { code: "ANH-010", folder: "le-gia-tien", filename: "anh-010.jpg", isRaw: false },
    { code: "ANH-011", folder: "le-gia-tien", filename: "anh-011.jpg", isRaw: false },
    { code: "ANH-012", folder: "le-gia-tien", filename: "anh-012.jpg", isRaw: false },
  ],
} as const;

export function demoPhotoStorageKey(folderKey: string, filename: string): string {
  return `tenant-demo/${DEMO_ALBUM.id}/${folderKey}/${filename}`;
}

export function demoPhotoThumbnailKey(folderKey: string, filename: string): string {
  const stem = filename.replace(/\.[^.]+$/, "");
  return `tenant-demo/${DEMO_ALBUM.id}/${folderKey}/${stem}-thumb.jpg`;
}

export function demoPhotoPreviewKey(folderKey: string, filename: string): string {
  const stem = filename.replace(/\.[^.]+$/, "");
  return `tenant-demo/${DEMO_ALBUM.id}/${folderKey}/${stem}-preview.jpg`;
}

export function demoDriveFilePath(folderKey: string, filename: string): string {
  return `demo-folder-1/${folderKey}/${filename}`;
}
