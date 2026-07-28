import assert from "node:assert/strict";
import test from "node:test";
import { professionalProfileInternals } from "../server/professional-profile.js";

const {
  availabilityWindowCreateSchema,
  credentialCreateSchema,
  credentialUpdateSchema,
  imageHasEmbeddedGps,
  mapCredential,
  portfolioUpdateSchema,
} = professionalProfileInternals;

test("professional credentials start private and never imply verification", () => {
  const parsed = credentialCreateSchema.parse({
    kind: "license",
    name: "Florida electrical contractor license",
    issuer: "DBPR",
    credentialNumber: "EC-123",
  });
  assert.equal(parsed.visibility, "private");
  assert.equal(parsed.issueDate, null);
  assert.equal(parsed.expiryDate, null);

  const mapped = mapCredential({
    id: "credential-1",
    kind: "license",
    name: parsed.name,
    issuer: parsed.issuer,
    credential_number: parsed.credentialNumber,
    issue_date: null,
    expiry_date: null,
    notes: "",
    evidence_state: "evidence_on_file",
    evidence_upload_id: "upload-1",
    visibility: "network",
    status: "active",
    version: 2,
    archived_at: null,
    created_at: "2026-07-27T12:00:00Z",
    updated_at: "2026-07-27T12:05:00Z",
  });
  assert.equal(mapped.evidenceState, "evidence_on_file");
  assert.equal("verified" in mapped, false);
});

test("professional credential dates and versions are bounded", () => {
  assert.equal(credentialCreateSchema.safeParse({
    kind: "certification",
    name: "OSHA 10",
    issueDate: "2026-08-01",
    expiryDate: "2026-07-01",
  }).success, false);
  assert.equal(credentialUpdateSchema.safeParse({
    kind: "certification",
    name: "OSHA 10",
    expectedVersion: 0,
  }).success, false);
});

test("availability windows require a real range no longer than one year", () => {
  const valid = availabilityWindowCreateSchema.parse({
    availability: "limited",
    startsOn: "2026-08-01",
    endsOn: "2026-08-31",
    notes: "Evenings",
  });
  assert.equal(valid.visibility, "network");
  assert.equal(availabilityWindowCreateSchema.safeParse({
    availability: "available",
    startsOn: "2026-09-01",
    endsOn: "2026-08-01",
  }).success, false);
  assert.equal(availabilityWindowCreateSchema.safeParse({
    availability: "available",
    startsOn: "2026-01-01",
    endsOn: "2028-01-01",
  }).success, false);
});

test("portfolio records require an explicit version and start private at creation", () => {
  const input = portfolioUpdateSchema.parse({
    expectedVersion: 1,
    title: "Service upgrade",
  });
  assert.equal(input.visibility, "private");
  assert.equal(input.sortOrder, 0);
  assert.equal(portfolioUpdateSchema.safeParse({
    expectedVersion: 1,
    title: "",
  }).success, false);
});

test("shared profile images reject embedded GPS metadata across supported formats", () => {
  const tiff = Buffer.alloc(26);
  tiff.write("II", 0, "ascii");
  tiff.writeUInt16LE(42, 2);
  tiff.writeUInt32LE(8, 4);
  tiff.writeUInt16LE(1, 8);
  tiff.writeUInt16LE(0x8825, 10);
  tiff.writeUInt16LE(4, 12);
  tiff.writeUInt32LE(1, 14);
  tiff.writeUInt32LE(26, 18);
  const exif = Buffer.concat([Buffer.from("Exif\0\0", "binary"), tiff]);

  const jpegLength = Buffer.alloc(2);
  jpegLength.writeUInt16BE(exif.length + 2);
  const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe1]), jpegLength, exif, Buffer.from([0xff, 0xd9])]);
  assert.equal(imageHasEmbeddedGps({ mimetype: "image/jpeg", buffer: jpeg }), true);

  const pngLength = Buffer.alloc(4);
  pngLength.writeUInt32BE(tiff.length);
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngLength,
    Buffer.from("eXIf"),
    tiff,
    Buffer.alloc(4),
  ]);
  assert.equal(imageHasEmbeddedGps({ mimetype: "image/png", buffer: png }), true);

  const webpLength = Buffer.alloc(4);
  webpLength.writeUInt32LE(tiff.length);
  const webp = Buffer.concat([
    Buffer.from("RIFF"),
    Buffer.alloc(4),
    Buffer.from("WEBP"),
    Buffer.from("EXIF"),
    webpLength,
    tiff,
  ]);
  assert.equal(imageHasEmbeddedGps({ mimetype: "image/webp", buffer: webp }), true);
  assert.equal(imageHasEmbeddedGps({ mimetype: "image/jpeg", buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]) }), false);
});
