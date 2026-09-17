import OpenAI from "openai";

const daySchema = {
  type: "object",
  additionalProperties: false,
  required: ["weekday", "status", "intervals"],
  properties: {
    weekday: { type: "integer", minimum: 1, maximum: 7, description: "Monday=1 through Sunday=7" },
    status: { type: "string", enum: ["open", "closed", "unverified"] },
    intervals: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["opensAt", "closesAt", "closesNextDay"],
        properties: {
          opensAt: { type: "string", description: "24-hour HH:mm" },
          closesAt: { type: "string", description: "24-hour HH:mm" },
          closesNextDay: { type: "boolean" },
        },
      },
    },
  },
};

const scheduleSchema = {
  type: "object",
  additionalProperties: false,
  required: ["sourceLabel", "coverageStart", "coverageEnd", "weekly", "specialPeriods", "exceptions", "warnings"],
  properties: {
    sourceLabel: { type: "string" },
    coverageStart: { type: "string", description: "YYYY-MM-DD, or empty when not explicit" },
    coverageEnd: { type: "string", description: "YYYY-MM-DD, or empty when not explicit" },
    weekly: { type: "array", items: daySchema },
    specialPeriods: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "startDate", "endDate", "days"],
        properties: {
          name: { type: "string" },
          startDate: { type: "string" },
          endDate: { type: "string" },
          days: { type: "array", items: daySchema },
        },
      },
    },
    exceptions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["date", "name", "status", "intervals"],
        properties: {
          date: { type: "string" },
          name: { type: "string" },
          status: { type: "string", enum: ["open", "closed", "unverified"] },
          intervals: daySchema.properties.intervals,
        },
      },
    },
    warnings: { type: "array", items: { type: "string" } },
  },
};

const EXTRACTION_PROMPT = `Extract this ULM facility-hours document into the supplied schema.
Use ISO dates (YYYY-MM-DD), ISO weekdays (Monday=1), and 24-hour times.
Regular weekly hours and each special period must contain all seven weekdays.
Use closed with no intervals only when the document explicitly says closed.
Use unverified with no intervals for anything missing or unclear.
Put named ranges such as finals week or spring break in specialPeriods.
Put holidays and single-date changes in exceptions.
Support multiple intervals per day and set closesNextDay only for closing after midnight.
Never infer a missing year, AM/PM, date, or time. Leave an ambiguous date/time empty or unverified and add a precise warning.
Do not use general knowledge. Extract only what is visible in the document.`;

export function detectScheduleMimeType(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;
  if (buffer.subarray(0, 5).toString() === "%PDF-") return "application/pdf";
  if (buffer[0] === 0x89 && buffer.subarray(1, 4).toString() === "PNG") return "image/png";
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.subarray(0, 4).toString() === "RIFF" && buffer.subarray(8, 12).toString() === "WEBP") return "image/webp";
  return null;
}

const extractionError = (message, status) => Object.assign(new Error(message), { status });

export async function extractSchedule(file, client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })) {
  if (!file?.buffer) throw extractionError("Schedule document is required", 400);
  const mimeType = detectScheduleMimeType(file.buffer);
  if (!mimeType) throw extractionError("Upload a valid PDF, PNG, JPEG, or WebP file", 400);

  const encoded = file.buffer.toString("base64");
  const documentPart = mimeType === "application/pdf"
    ? {
        type: "input_file",
        filename: file.originalname?.toLowerCase().endsWith(".pdf") ? file.originalname : "schedule.pdf",
        file_data: `data:${mimeType};base64,${encoded}`,
      }
    : {
        type: "input_image",
        image_url: `data:${mimeType};base64,${encoded}`,
        detail: "high",
      };

  const response = await client.responses.create({
    model: process.env.HOURS_EXTRACTION_MODEL || "gpt-4.1-mini",
    input: [{ role: "user", content: [{ type: "input_text", text: EXTRACTION_PROMPT }, documentPart] }],
    text: {
      format: {
        type: "json_schema",
        name: "campus_hours_schedule",
        strict: true,
        schema: scheduleSchema,
      },
    },
  });

  if (!response.output_text) throw extractionError("The extraction model returned no schedule", 502);
  try {
    return JSON.parse(response.output_text);
  } catch {
    throw extractionError("The extraction model returned invalid structured data", 502);
  }
}

