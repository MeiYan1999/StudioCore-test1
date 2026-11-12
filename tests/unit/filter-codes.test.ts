import { describe, expect, it } from "vitest";
import {
  buildManifestCsv,
  buildMissingText,
  fileCategory,
  fileMatchesType,
  isOutputOrIgnoredDirectory,
  matchCodesToFiles,
  parseCustomerCodes,
  suggestSimilarAlbumCodes,
  type FilterFileEntry,
} from "@/lib/photos/filter-codes";

const files: FilterFileEntry[] = [
  {
    name: "anh-001.jpg",
    relativePath: "duoi-ca/anh-001.jpg",
    size: 10,
    lastModified: 0,
    category: "standard",
  },
  {
    name: "ANH-002.JPG",
    relativePath: "truyen-thong/ANH-002.JPG",
    size: 10,
    lastModified: 0,
    category: "standard",
  },
  {
    name: "anh-002.cr2",
    relativePath: "truyen-thong/anh-002.cr2",
    size: 20,
    lastModified: 0,
    category: "raw",
  },
  {
    name: "IMG_1234.jpg",
    relativePath: "le-gia-tien/IMG_1234.jpg",
    size: 10,
    lastModified: 0,
    category: "standard",
  },
  {
    name: "IMG_5678.jpg",
    relativePath: "le-gia-tien/IMG_5678.jpg",
    size: 10,
    lastModified: 0,
    category: "standard",
  },
];

describe("parse mã ảnh khách chọn", () => {
  it("parse Excel/Zalo, dấu phẩy, khoảng trắng, số thứ tự, đuôi file, path", () => {
    const parsed = parseCustomerCodes(
      '1. ANH-001.jpg\n2) "anh-002"\nANH-003,  ANH-004\tANH-005\nC:\\ảnh\\ANH-006.JPG\nANH-001',
      "alphanumeric",
    );
    expect(parsed.totalTokens).toBe(7);
    expect(parsed.valid).toHaveLength(6);
    expect(parsed.duplicateCount).toBe(1);
    expect(parsed.invalidCount).toBe(0);
    expect(parsed.valid[0]?.normalized).toBe("anh-001");
    expect(parsed.valid.at(-1)?.normalized).toBe("anh-006");
  });

  it("phát hiện trùng sau chuẩn hóa và mã không hợp lệ", () => {
    const parsed = parseCustomerCodes(
      "ANH-001, anh-001.jpg, ???, ANH 002",
      "alphanumeric",
    );
    expect(parsed.valid.map((item) => item.normalized)).toEqual([
      "anh-001",
      "anh",
      "002",
    ]);
    expect(parsed.duplicateCount).toBe(1);
    expect(parsed.invalidCount).toBe(1);
  });

  it("chế độ chỉ số lấy cụm số cuối và đánh dấu nhiều cụm", () => {
    const parsed = parseCustomerCodes(
      "ANH-001.jpg IMG_1234 ANH-2024-001 abc",
      "numeric",
    );
    expect(parsed.valid).toHaveLength(2);
    expect(parsed.valid[0]?.numericToken).toBe("001");
    expect(parsed.valid[1]?.numericToken).toBe("1234");
    expect(parsed.duplicateCount).toBe(1);
    expect(parsed.numericAmbiguousCount).toBe(1);
    expect(parsed.invalidCount).toBe(1);
  });
});

describe("so khớp file", () => {
  it("exact basename, ambiguous và missing", () => {
    const parsed = parseCustomerCodes(
      "ANH-001 ANH-002 ANH-999",
      "alphanumeric",
    );
    const result = matchCodesToFiles(parsed.valid, files, "alphanumeric");
    expect(result.matchedCount).toBe(1);
    expect(result.ambiguousCount).toBe(1);
    expect(result.missingCount).toBe(1);
    expect(result.items.find((item) => item.parsed.raw === "ANH-002")?.candidates).toHaveLength(2);
  });

  it("chế độ chỉ số khớp file RAW/JPG và lọc định dạng", () => {
    const parsed = parseCustomerCodes("2 1234", "numeric");
    const all = matchCodesToFiles(parsed.valid, files, "numeric");
    expect(all.ambiguousCount).toBe(1);
    expect(all.matchedCount).toBe(1);
    expect(all.items.find((item) => item.parsed.raw === "2")?.candidates).toHaveLength(2);

    const standardFiles = files.filter((file) =>
      fileMatchesType(file, "standard"),
    );
    const standard = matchCodesToFiles(parsed.valid, standardFiles, "numeric");
    expect(standard.items.find((item) => item.parsed.raw === "2")?.status).toBe(
      "matched",
    );
    expect(fileMatchesType(files[2] as FilterFileEntry, "raw")).toBe(true);
    expect(fileCategory("photo.CR2")).toBe("raw");
  });

  it("gợi ý mã gần đúng và manifest/missing", () => {
    const suggestions = suggestSimilarAlbumCodes("ANH-01", [
      { code: "ANH-001", filename: "anh-001.jpg" },
      { code: "ANH-002", filename: "anh-002.jpg" },
    ]);
    expect(suggestions[0]?.code).toBe("ANH-001");

    const manifest = buildManifestCsv([
      {
        inputCode: "ANH-001",
        filename: "anh-001.jpg",
        relativePath: "duoi-ca/anh-001.jpg",
        status: "matched",
      },
    ]);
    expect(manifest).toContain("input_code,filename");
    expect(manifest).toContain("duoi-ca/anh-001.jpg");
    expect(buildMissingText([{ inputCode: "ANH-999" }])).toBe("ANH-999");
  });

  it("nhận diện đúng định dạng RAW hiện đại (Canon CR3, RW2, ORF, v.v.)", () => {
    expect(fileCategory("SAM00013.CR3")).toBe("raw");
    expect(fileCategory("SAM00013.cr3")).toBe("raw");
    expect(fileCategory("P1010001.RW2")).toBe("raw");
    expect(fileCategory("PA120001.ORF")).toBe("raw");
    expect(fileCategory("DSC_0001.NEF")).toBe("raw");
    expect(fileCategory("DSC0001.ARW")).toBe("raw");
    expect(fileCategory("SAM00013.JPG")).toBe("standard");
    expect(fileCategory("SAM00013.png")).toBe("standard");
    expect(fileCategory("SAM00013.heic")).toBe("standard");
  });

  it("bỏ qua thư mục xuất ảnh / khách chọn để tránh đệ quy quét trùng", () => {
    expect(isOutputOrIgnoredDirectory("Ảnh Khách Chọn")).toBe(true);
    expect(isOutputOrIgnoredDirectory("Ảnh Khách Chọnđ")).toBe(true);
    expect(isOutputOrIgnoredDirectory("Anh Khach Chon")).toBe(true);
    expect(isOutputOrIgnoredDirectory("Ảnh Đã Lọc")).toBe(true);
    expect(isOutputOrIgnoredDirectory("Export")).toBe(true);
    expect(isOutputOrIgnoredDirectory("Selected")).toBe(true);
    expect(isOutputOrIgnoredDirectory(".hidden")).toBe(true);

    expect(isOutputOrIgnoredDirectory("le-gia-tien")).toBe(false);
    expect(isOutputOrIgnoredDirectory("duoi-ca")).toBe(false);
    expect(isOutputOrIgnoredDirectory("1-11 GV Nguyễn Ngọc Triệu 15h30")).toBe(false);
  });

  it("ưu tiên khớp chính xác tên file có đuôi và bỏ qua file trong thư mục output", () => {
    const testFiles: FilterFileEntry[] = [
      {
        name: "SAM00013.JPG",
        relativePath: "SAM00013.JPG",
        size: 5000,
        lastModified: 0,
        category: "standard",
      },
      {
        name: "SAM00013.JPG",
        relativePath: "Ảnh Khách Chọn/SAM00013.JPG",
        size: 5000,
        lastModified: 0,
        category: "standard",
      },
      {
        name: "SAM00013.CR3",
        relativePath: "SAM00013.CR3",
        size: 25000,
        lastModified: 0,
        category: "raw",
      },
    ];

    // Người dùng nhập SAM00013.JPG kèm đuôi file
    const parsedWithExt = parseCustomerCodes("SAM00013.JPG", "alphanumeric");
    const matchedWithExt = matchCodesToFiles(parsedWithExt.valid, testFiles, "alphanumeric");
    expect(matchedWithExt.matchedCount).toBe(1);
    expect(matchedWithExt.ambiguousCount).toBe(0);
    expect(matchedWithExt.items[0]?.matchedFile?.relativePath).toBe("SAM00013.JPG");

    // Chỉ có 2 file cùng tên: 1 ở gốc và 1 ở thư mục "Ảnh Khách Chọn"
    const filesWithDuplicateInSubfolder: FilterFileEntry[] = [
      {
        name: "SAM00055.JPG",
        relativePath: "SAM00055.JPG",
        size: 5000,
        lastModified: 0,
        category: "standard",
      },
      {
        name: "SAM00055.JPG",
        relativePath: "Ảnh Khách Chọn/SAM00055.JPG",
        size: 5000,
        lastModified: 0,
        category: "standard",
      },
    ];
    const parsed55 = parseCustomerCodes("SAM00055", "alphanumeric");
    const matched55 = matchCodesToFiles(parsed55.valid, filesWithDuplicateInSubfolder, "alphanumeric");
    expect(matched55.matchedCount).toBe(1);
    expect(matched55.ambiguousCount).toBe(0);
    expect(matched55.items[0]?.matchedFile?.relativePath).toBe("SAM00055.JPG");
  });
});
