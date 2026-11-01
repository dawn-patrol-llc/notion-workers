import { Worker } from "@notionhq/workers";
import {
  createInvoice,
  getInvoice,
  listAllInvoices,
  listAllCustomers,
  buildInvoicePaymentUrl,
} from "./mercury.js";

const worker = new Worker();
export default worker;

worker.tool("createInvoice", {
  title: "Create Mercury Invoice",
  description:
    "Creates a draft invoice in Mercury (without sending it) from billable hours and amounts. Returns the invoice ID and a payment link the recipient can use to pay.",
  schema: {
    type: "object",
    properties: {
      customerId: {
        type: "string",
        description: "Mercury customer UUID to invoice",
      },
      invoiceNumber: {
        type: "string",
        description:
          "Required stable payer-facing invoice number, reused for reconciliation after an uncertain result. Never pass null or change the number to retry.",
      },
      dueDate: {
        type: "string",
        description: "Payment due date in YYYY-MM-DD format",
      },
      lineItems: {
        type: "array",
        description: "Invoice line items for billable work",
        items: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description:
                "Description of the billable work (e.g. 'Frontend Development - Feb 2026')",
            },
            unitPrice: {
              type: "number",
              description: "Hourly rate or unit price in dollars",
            },
            quantity: {
              type: "number",
              description: "Number of hours or units",
            },
            salesTaxRate: {
              anyOf: [{ type: "number" }, { type: "null" }],
              description:
                "Sales tax rate as a decimal (e.g. 0.08 for 8%). Pass null if no tax.",
            },
          },
          required: ["name", "unitPrice", "quantity", "salesTaxRate"],
          additionalProperties: false,
        },
      },
      ccEmails: {
        anyOf: [{ type: "array", items: { type: "string" } }, { type: "null" }],
        description:
          "Email addresses to CC on the invoice. Pass null or empty array if none.",
      },
      payerMemo: {
        anyOf: [{ type: "string" }, { type: "null" }],
        description: "Memo visible to the payer. Pass null if none.",
      },
      internalNote: {
        anyOf: [{ type: "string" }, { type: "null" }],
        description: "Internal note not visible to payer. Pass null if none.",
      },
      servicePeriodStartDate: {
        anyOf: [{ type: "string" }, { type: "null" }],
        description:
          "Service period start date in YYYY-MM-DD format. Pass null if not applicable.",
      },
      servicePeriodEndDate: {
        anyOf: [{ type: "string" }, { type: "null" }],
        description:
          "Service period end date in YYYY-MM-DD format. Pass null if not applicable.",
      },
    },
    required: [
      "customerId",
      "invoiceNumber",
      "dueDate",
      "lineItems",
      "ccEmails",
      "payerMemo",
      "internalNote",
      "servicePeriodStartDate",
      "servicePeriodEndDate",
    ],
    additionalProperties: false,
  },
  execute: async ({
    customerId,
    invoiceNumber,
    dueDate,
    lineItems,
    ccEmails,
    payerMemo,
    internalNote,
    servicePeriodStartDate,
    servicePeriodEndDate,
  }: {
    customerId: string;
    invoiceNumber: string;
    dueDate: string;
    lineItems: Array<{
      name: string;
      unitPrice: number;
      quantity: number;
      salesTaxRate: number | null;
    }>;
    ccEmails: string[] | null;
    payerMemo: string | null;
    internalNote: string | null;
    servicePeriodStartDate: string | null;
    servicePeriodEndDate: string | null;
  }) => {
    const destinationAccountId = process.env.MERCURY_ACCOUNT_ID;
    if (!destinationAccountId) {
      throw new Error("MERCURY_ACCOUNT_ID environment variable is not set");
    }

    const today = new Date().toISOString().split("T")[0];

    const invoice = await createInvoice({
      customerId,
      invoiceNumber,
      invoiceDate: today,
      dueDate,
      destinationAccountId,
      lineItems: lineItems.map((item) => ({
        name: item.name,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        ...(item.salesTaxRate != null && { salesTaxRate: item.salesTaxRate }),
      })),
      ccEmails: ccEmails ?? [],
      creditCardEnabled: false,
      achDebitEnabled: true,
      useRealAccountNumber: false,
      sendEmailOption: "DontSend",
      ...(payerMemo != null && { payerMemo }),
      ...(internalNote != null && { internalNote }),
      ...(servicePeriodStartDate != null && { servicePeriodStartDate }),
      ...(servicePeriodEndDate != null && { servicePeriodEndDate }),
    });

    const paymentUrl = buildInvoicePaymentUrl(invoice.slug);

    return JSON.stringify({
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      amount: invoice.amount,
      paymentUrl,
      message: `Unsent invoice created for review. Payment link: ${paymentUrl}`,
      manualVerificationRequired: ["automated reminders on", "recurring off", "one-time payment"],
    });
  },
});

worker.tool("getInvoice", {
  title: "Get Mercury Invoice",
  description:
    "Retrieves an existing Mercury invoice by ID. Returns the invoice details and payment link.",
  schema: {
    type: "object",
    properties: {
      invoiceId: {
        type: "string",
        description: "The UUID of the Mercury invoice to retrieve",
      },
    },
    required: ["invoiceId"],
    additionalProperties: false,
  },
  execute: async ({ invoiceId }: { invoiceId: string }) => {
    const invoice = await getInvoice(invoiceId);
    const paymentUrl = buildInvoicePaymentUrl(invoice.slug);

    return JSON.stringify({
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      amount: invoice.amount,
      dueDate: invoice.dueDate,
      invoiceDate: invoice.invoiceDate,
      customerId: invoice.customerId,
      payerMemo: invoice.payerMemo ?? null,
      servicePeriodStartDate: invoice.servicePeriodStartDate ?? null,
      servicePeriodEndDate: invoice.servicePeriodEndDate ?? null,
      lineItems: invoice.lineItems,
      paymentUrl,
    });
  },
});

worker.tool("listCustomers", {
  title: "List Mercury Customers",
  description:
    "Lists all customers in Mercury. Use this to find a customer's UUID by name before creating an invoice.",
  schema: {
    type: "object",
    properties: {
      searchName: {
        anyOf: [{ type: "string" }, { type: "null" }],
        description:
          "Filter customers by name (case-insensitive partial match). Pass null to list all.",
      },
    },
    required: ["searchName"],
    additionalProperties: false,
  },
  execute: async ({ searchName }: { searchName: string | null }) => {
    const customers = await listAllCustomers();

    const filtered = searchName
      ? customers.filter((c) =>
          c.name.toLowerCase().includes(searchName.toLowerCase())
        )
      : customers;

    return JSON.stringify(
      filtered.map((c) => ({
        id: c.id,
        name: c.name,
        email: c.email,
      }))
    );
  },
});

worker.tool("listInvoices", {
  title: "List Mercury Invoices",
  description:
    "Lists invoices in Mercury, optionally filtered by customer name and/or status. Use this to find recurring retainer invoices or check invoice status.",
  schema: {
    type: "object",
    properties: {
      customerName: {
        anyOf: [{ type: "string" }, { type: "null" }],
        description:
          "Filter invoices by customer name (case-insensitive partial match). Pass null for all customers.",
      },
      status: {
        anyOf: [
          { type: "string", enum: ["Unpaid", "Paid", "Cancelled", "Processing"] },
          { type: "null" },
        ],
        description:
          "Filter by invoice status. Pass null for all statuses.",
      },
    },
    required: ["customerName", "status"],
    additionalProperties: false,
  },
  execute: async ({
    customerName,
    status,
  }: {
    customerName: string | null;
    status: string | null;
  }) => {
    // Resolve customer name to ID if provided
    let customerIds: Set<string> | null = null;
    if (customerName) {
      const customers = await listAllCustomers();
      const matches = customers.filter((c) =>
        c.name.toLowerCase().includes(customerName.toLowerCase())
      );
      customerIds = new Set(matches.map((c) => c.id));
      if (customerIds.size === 0) {
        return JSON.stringify({
          invoices: [],
          message: `No customers found matching "${customerName}"`,
        });
      }
    }

    const invoices = await listAllInvoices();

    const filtered = invoices.filter((inv) => {
      if (customerIds && !customerIds.has(inv.customerId)) return false;
      if (status && inv.status !== status) return false;
      return true;
    });

    return JSON.stringify(
      filtered.map((inv) => ({
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        status: inv.status,
        amount: inv.amount,
        dueDate: inv.dueDate,
        invoiceDate: inv.invoiceDate,
        customerId: inv.customerId,
        paymentUrl: buildInvoicePaymentUrl(inv.slug),
      }))
    );
  },
});
