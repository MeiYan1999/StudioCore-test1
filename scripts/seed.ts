import { createDb } from "../src/lib/db/client";
import { seedDatabase } from "../src/lib/db/seed";
import { generateDemoAlbumAssets } from "../src/lib/storage/local-storage";

await generateDemoAlbumAssets();

const db = createDb();
const summary = seedDatabase(db);

console.log("Đã seed dữ liệu demo (bao gồm ảnh synthetic Phase 4):");
console.log(JSON.stringify(summary, null, 2));
