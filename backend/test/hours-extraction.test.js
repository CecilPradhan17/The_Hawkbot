import test from "node:test";
import assert from "node:assert/strict";
import { detectScheduleMimeType, extractSchedule } from "../src/services/hours-extraction.services.js";

const proposal = {
  sourceLabel: "Fall 2026",
  coverageStart: "2026-08-17",
  coverageEnd: "2026-12-18",
  weekly: [],
  specialPeriods: [],
  exceptions: [],
  warnings: [],
};

const fakeClient = response => {
  const requests = [];
  return {
    requests,
    responses: { create: async request => { requests.push(request); return response; } },
  };
};

test("detects supported formats from bytes instead of trusting the filename", () => {
  assert.equal(detectScheduleMimeType(Buffer.from("%PDF-1.7 sample")), "application/pdf");
  assert.equal(detectScheduleMimeType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0])), "image/png");
  assert.equal(detectScheduleMimeType(Buffer.from([0xff, 0xd8, 0xff, 0, 0, 0, 0, 0, 0, 0, 0, 0])), "image/jpeg");
  assert.equal(detectScheduleMimeType(Buffer.from("not a document")), null);
});

test("sends a PDF as an ephemeral base64 input_file", async () => {
  const client = fakeClient({ output_text: JSON.stringify(proposal) });
  const result = await extractSchedule({ originalname: "hours.pdf", buffer: Buffer.from("%PDF-1.7 schedule") }, client);
  const request = client.requests[0];
  const inputFile = request.input[0].content[1];
  assert.equal(inputFile.type, "input_file");
  assert.match(inputFile.file_data, /^data:application\/pdf;base64,/);
  assert.equal(request.text.format.type, "json_schema");
  assert.equal(request.text.format.schema.properties.weekly.minItems, 7);
  assert.equal(request.text.format.schema.properties.weekly.maxItems, 7);
  assert.equal(request.text.format.schema.properties.specialPeriods.items.properties.days.minItems, 7);
  const prompt = request.input[0].content[0].text;
  assert.match(prompt, /Expand grouped weekday labels and ranges/);
  assert.match(prompt, /Monday-Friday.*Monday, Tuesday, Wednesday, Thursday, and Friday/s);
  assert.match(prompt, /earliest and latest explicit calendar dates/);
  assert.deepEqual(result, proposal);
});

test("sends an image through the vision input path", async () => {
  const client = fakeClient({ output_text: JSON.stringify(proposal) });
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0]);
  await extractSchedule({ originalname: "hours.exe", buffer: png }, client);
  const image = client.requests[0].input[0].content[1];
  assert.equal(image.type, "input_image");
  assert.match(image.image_url, /^data:image\/png;base64,/);
});

test("rejects unsupported bytes before calling OpenAI", async () => {
  const client = fakeClient({ output_text: JSON.stringify(proposal) });
  await assert.rejects(
    () => extractSchedule({ originalname: "fake.pdf", buffer: Buffer.from("not really a pdf") }, client),
    error => error.status === 400
  );
  assert.equal(client.requests.length, 0);
});

test("returns a controlled error for missing or invalid model output", async () => {
  const pdf = { originalname: "hours.pdf", buffer: Buffer.from("%PDF-1.7 schedule") };
  await assert.rejects(() => extractSchedule(pdf, fakeClient({ output_text: "" })), error => error.status === 502);
  await assert.rejects(() => extractSchedule(pdf, fakeClient({ output_text: "not json" })), error => error.status === 502);
});

