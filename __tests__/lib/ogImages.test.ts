import { sniffImageType } from "@/lib/og/images";

const pad = (header: number[]) => Buffer.concat([Buffer.from(header), Buffer.alloc(16)]);

describe("sniffImageType", () => {
  it("identifies formats from magic bytes, not the file extension", () => {
    expect(sniffImageType(pad([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffImageType(pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(sniffImageType(pad([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]))).toBe("image/gif");
  });

  it("identifies webp, which needs both the RIFF and WEBP markers", () => {
    const webp = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBP"), Buffer.alloc(8)]);
    expect(sniffImageType(webp)).toBe("image/webp");
    const riffOnly = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("AVI "), Buffer.alloc(8)]);
    expect(sniffImageType(riffOnly)).toBeNull();
  });

  // The case this exists for: profile photos served as image/jpeg that are really PNGs
  it("reports PNG bytes as PNG regardless of a .jpg name or jpeg content-type", () => {
    expect(sniffImageType(pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).not.toBe("image/jpeg");
  });

  it("returns null for unrecognised or truncated input", () => {
    expect(sniffImageType(Buffer.from("<!DOCTYPE html><html>"))).toBeNull();
    expect(sniffImageType(Buffer.from([0xff, 0xd8]))).toBeNull();
    expect(sniffImageType(Buffer.alloc(0))).toBeNull();
  });
});
