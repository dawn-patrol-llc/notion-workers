import { Worker } from "@notionhq/workers";

const worker = new Worker();
export default worker;

function hmsToDecimal(hms: string): number {
  const parts = hms.split(":");
  const hours = parseFloat(parts[0]);
  const minutes = parseFloat(parts[1]);
  const seconds = parseFloat(parts[2]);
  return hours + minutes / 60 + seconds / 3600;
}

function decimalToHms(decimalHours: number): string {
  const totalSeconds = Math.round(decimalHours * 3600);
  const hours = Math.floor(totalSeconds / 3600);
  const remainder = totalSeconds % 3600;
  const minutes = Math.floor(remainder / 60);
  const seconds = remainder % 60;
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

worker.tool("convertToDecimal", {
  title: "Convert Time to Decimal Hours",
  description:
    "Convert a time string in HH:MM:SS format to decimal hours. Optionally provide an hourly rate to calculate the billable amount.",
  schema: {
    type: "object",
    properties: {
      time: {
        type: "string",
        description: "Time in HH:MM:SS format (e.g. 03:30:30)",
      },
      rate: {
        anyOf: [{ type: "number" }, { type: "null" }],
        description:
          "Optional hourly rate to calculate billable amount. Pass null to skip.",
      },
    },
    required: ["time", "rate"],
    additionalProperties: false,
  },
  execute: async ({ time, rate }: { time: string; rate: number | null }) => {
    const decimalHours = hmsToDecimal(time);

    const result: { decimalHours: string; billableAmount?: string } = {
      decimalHours: decimalHours.toFixed(5),
    };

    if (rate !== null) {
      const amount = decimalHours * rate;
      result.billableAmount = `$${amount.toFixed(2)}`;
    }

    return JSON.stringify(result);
  },
});

worker.tool("convertToHms", {
  title: "Convert Decimal Hours to HH:MM:SS",
  description:
    "Convert decimal hours to HH:MM:SS format, rounded to the nearest second.",
  schema: {
    type: "object",
    properties: {
      decimalHours: {
        type: "number",
        description: "Decimal hours (e.g. 3.50833)",
      },
    },
    required: ["decimalHours"],
    additionalProperties: false,
  },
  execute: async ({ decimalHours }: { decimalHours: number }) => {
    const hms = decimalToHms(decimalHours);
    return JSON.stringify({ hms });
  },
});

worker.tool("calculateBillable", {
  title: "Calculate Billable Amount",
  description:
    "Given decimal hours and an hourly rate, calculate the billable amount.",
  schema: {
    type: "object",
    properties: {
      decimalHours: {
        type: "number",
        description: "Number of hours as a decimal (e.g. 3.50833)",
      },
      rate: {
        type: "number",
        description: "Hourly rate in dollars (e.g. 150)",
      },
    },
    required: ["decimalHours", "rate"],
    additionalProperties: false,
  },
  execute: async ({
    decimalHours,
    rate,
  }: {
    decimalHours: number;
    rate: number;
  }) => {
    const amount = decimalHours * rate;
    return JSON.stringify({
      decimalHours: decimalHours.toFixed(5),
      rate: `$${rate.toFixed(2)}/hr`,
      billableAmount: `$${amount.toFixed(2)}`,
    });
  },
});
