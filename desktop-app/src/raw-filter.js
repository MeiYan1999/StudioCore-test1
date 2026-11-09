const fs = require("node:fs");
const path = require("node:path");

/**
 * Tự động lọc và copy file RAW/JPG khách đã chọn ra thư mục Retouch_Final
 * @param {string} sourceFolder - Thư mục gốc chứa ảnh của show
 * @param {Array<{filename: string, code: string, note?: string}>} selectedItems - Danh sách ảnh khách đã duyệt
 * @returns {{copiedCount: number, destinationFolder: string, codesList: string}}
 */
function autoFilterRawFiles(sourceFolder, selectedItems) {
  if (!fs.existsSync(sourceFolder)) {
    throw new Error(`Thư mục nguồn không tồn tại: ${sourceFolder}`);
  }

  const destinationFolder = path.join(sourceFolder, "Retouch_Final");
  if (!fs.existsSync(destinationFolder)) {
    fs.mkdirSync(destinationFolder, { recursive: true });
  }

  const cleanCodes = selectedItems.map((item) => {
    const raw = item.code || item.filename || "";
    return path.basename(raw, path.extname(raw));
  }).filter(Boolean);

  const cleanCodesSet = new Set(cleanCodes.map((c) => c.toLowerCase()));

  // Scan source directory for files matching base codes (including .CR3, .ARW, .JPG, .XMP)
  const allFilesInSource = fs.readdirSync(sourceFolder);
  let copiedCount = 0;
  const notesLog = [];

  for (const file of allFilesInSource) {
    const baseName = path.basename(file, path.extname(file)).toLowerCase();
    if (cleanCodesSet.has(baseName)) {
      const srcFile = path.join(sourceFolder, file);
      const destFile = path.join(destinationFolder, file);

      try {
        fs.copyFileSync(srcFile, destFile);
        copiedCount++;
      } catch (err) {
        console.error(`Lỗi sao chép file ${file}:`, err);
      }
    }
  }

  // Create Lightroom codes file
  const codesList = cleanCodes.join(", ");
  const codesFilePath = path.join(destinationFolder, "lightroom_filter_codes.txt");
  fs.writeFileSync(codesFilePath, codesList, "utf8");

  // Create Client Notes file
  for (const item of selectedItems) {
    if (item.note) {
      notesLog.push(`[${item.filename || item.code}]: ${item.note}`);
    }
  }
  if (notesLog.length > 0) {
    const notesFilePath = path.join(destinationFolder, "client_retouch_notes.txt");
    fs.writeFileSync(notesFilePath, notesLog.join("\n\n"), "utf8");
  }

  return {
    copiedCount,
    destinationFolder,
    codesList,
    notesCount: notesLog.length,
  };
}

module.exports = {
  autoFilterRawFiles,
};
