import iconv from "iconv-lite";
import { describe, expect, it } from "vitest";

import {
    decodeBuffer,
    DEFAULT_ENCODING,
    detectEncodingByBOM,
    encodeText,
    getEncodingInfo,
    SUPPORTED_ENCODINGS,
} from "./Encoding.ts";

describe("SUPPORTED_ENCODINGS", () => {
    it("every iconvName exists in iconv-lite", () => {
        for (const info of SUPPORTED_ENCODINGS) {
            expect(iconv.encodingExists(info.iconvName), `iconv-lite lacks "${info.iconvName}" (${info.id})`).toBe(
                true,
            );
        }
    });

    it("ids are unique", () => {
        const ids = SUPPORTED_ENCODINGS.map((info) => info.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it("getEncodingInfo resolves known ids and rejects unknown ones", () => {
        expect(getEncodingInfo("windows1251")?.label).toBe("Cyrillic (Windows 1251)");
        expect(getEncodingInfo("nope")).toBeUndefined();
    });

    it("default encoding is part of the table", () => {
        expect(getEncodingInfo(DEFAULT_ENCODING)).toBeDefined();
    });
});

describe("detectEncodingByBOM", () => {
    it("detects the UTF-8 BOM", () => {
        expect(detectEncodingByBOM(Buffer.from([0xef, 0xbb, 0xbf, 0x61]))).toBe("utf8bom");
    });

    it("detects the UTF-16 LE BOM", () => {
        expect(detectEncodingByBOM(Buffer.from([0xff, 0xfe, 0x61, 0x00]))).toBe("utf16le");
    });

    it("detects the UTF-16 BE BOM", () => {
        expect(detectEncodingByBOM(Buffer.from([0xfe, 0xff, 0x00, 0x61]))).toBe("utf16be");
    });

    it("returns null without a BOM", () => {
        expect(detectEncodingByBOM(Buffer.from("plain ascii"))).toBeNull();
        expect(detectEncodingByBOM(Buffer.alloc(0))).toBeNull();
    });

    it("does not misread a partial BOM prefix", () => {
        expect(detectEncodingByBOM(Buffer.from([0xef, 0xbb]))).toBeNull();
        expect(detectEncodingByBOM(Buffer.from([0xff]))).toBeNull();
    });
});

describe("decodeBuffer", () => {
    it("defaults to utf8 without a BOM", () => {
        const { text, encoding } = decodeBuffer(Buffer.from("привет", "utf8"));
        expect(text).toBe("привет");
        expect(encoding).toBe("utf8");
    });

    it("strips the BOM from utf8bom text", () => {
        const buffer = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from("hi", "utf8")]);
        const { text, encoding } = decodeBuffer(buffer);
        expect(text).toBe("hi");
        expect(encoding).toBe("utf8bom");
    });

    it("decodes utf16le and utf16be by BOM", () => {
        const le = decodeBuffer(Buffer.concat([Buffer.from([0xff, 0xfe]), iconv.encode("абв", "utf16le")]));
        expect(le).toEqual({ text: "абв", encoding: "utf16le" });

        const be = decodeBuffer(Buffer.concat([Buffer.from([0xfe, 0xff]), iconv.encode("абв", "utf16-be")]));
        expect(be).toEqual({ text: "абв", encoding: "utf16be" });
    });

    it("an explicit encoding wins over the utf8 default", () => {
        const bytes = iconv.encode("привет", "windows1251");
        const { text, encoding } = decodeBuffer(bytes, "windows1251");
        expect(text).toBe("привет");
        expect(encoding).toBe("windows1251");
    });

    it("promotes explicit utf8 to utf8bom when the buffer carries a UTF-8 BOM", () => {
        const buffer = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from("x", "utf8")]);
        const { text, encoding } = decodeBuffer(buffer, "utf8");
        expect(text).toBe("x");
        expect(encoding).toBe("utf8bom");
    });

    it("explicit non-utf8 encoding suppresses BOM re-detection", () => {
        // A windows1251 file that happens to start with the utf8 BOM bytes is
        // still decoded as windows1251 when the user asked for it.
        const bytes = iconv.encode("ïâ", "windows1251");
        const { encoding } = decodeBuffer(bytes, "windows1251");
        expect(encoding).toBe("windows1251");
    });

    it("explicit utf8bom on a BOM-less buffer does not eat leading bytes", () => {
        const { text, encoding } = decodeBuffer(Buffer.from("abc", "utf8"), "utf8bom");
        expect(text).toBe("abc");
        expect(encoding).toBe("utf8bom");
    });

    it("unknown explicit id falls back to sniff-or-default", () => {
        const { encoding } = decodeBuffer(Buffer.from("abc"), "martian");
        expect(encoding).toBe("utf8");
    });
});

describe("encodeText", () => {
    it("utf8 writes no BOM", () => {
        expect([...encodeText("hi", "utf8")]).toEqual([...Buffer.from("hi", "utf8")]);
    });

    it("utf8bom always writes the BOM", () => {
        expect([...encodeText("hi", "utf8bom").subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    });

    it("utf16le/utf16be always write their BOM", () => {
        expect([...encodeText("a", "utf16le").subarray(0, 2)]).toEqual([0xff, 0xfe]);
        expect([...encodeText("a", "utf16be").subarray(0, 2)]).toEqual([0xfe, 0xff]);
    });

    it("unknown id falls back to utf8", () => {
        expect([...encodeText("hi", "martian")]).toEqual([...Buffer.from("hi", "utf8")]);
    });

    it("unencodable characters degrade to the replacement character", () => {
        const bytes = encodeText("日本語", "windows1251");
        expect(iconv.decode(bytes, "windows1251")).toBe("???");
    });
});

describe("roundtrips (byte-exact)", () => {
    const samples: Array<[string, string]> = [
        ["utf8", "line one\nстрока два\n"],
        ["utf8bom", "with bom\nкириллица\n"],
        ["utf16le", "utf16 le\nтекст\n"],
        ["utf16be", "utf16 be\nтекст\n"],
        ["windows1251", "Привет, мир!\nЁжик — №5\n"],
        ["koi8r", "Кириллица КОИ-8\n"],
    ];

    for (const [encoding, text] of samples) {
        it(`${encoding}: decode(encode(text)) preserves text and bytes`, () => {
            const bytes = encodeText(text, encoding);
            const decoded = decodeBuffer(bytes);
            // BOM-less single-byte encodings sniff back to utf8 — force the id.
            const decodedExplicit = decodeBuffer(bytes, encoding);
            expect(decodedExplicit.text).toBe(text);
            expect(decodedExplicit.encoding).toBe(encoding);
            if (encoding === "utf8bom" || encoding === "utf16le" || encoding === "utf16be") {
                expect(decoded.encoding).toBe(encoding);
                expect(decoded.text).toBe(text);
            }
            expect([...encodeText(decodedExplicit.text, decodedExplicit.encoding)]).toEqual([...bytes]);
        });
    }
});
