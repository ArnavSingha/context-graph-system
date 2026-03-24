import "dotenv/config";

import csvParser from "csv-parser";
import { createReadStream, promises as fs } from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { Client } from "pg";

type Row = Record<string, unknown>;

const ROOT_DIR = process.cwd();
const DATA_DIR = path.join(ROOT_DIR, "sap-o2c-data");
const SCHEMA_FILE = path.join(ROOT_DIR, "sql", "schema.sql");

const TABLE_LOADERS: Array<{
  tableName: string;
  sourceDir: string;
  transform: (row: Row) => Row;
  columns: string[];
  conflictColumns: string[];
}> = [
  {
    tableName: "customers",
    sourceDir: "business_partners",
    columns: [
      "customer_id",
      "business_partner_id",
      "business_partner_category",
      "business_partner_grouping",
      "full_name",
      "display_name",
      "first_name",
      "last_name",
      "language_code",
      "created_by_user",
      "creation_date",
      "last_change_date",
      "is_blocked",
      "is_archived",
    ],
    conflictColumns: ["customer_id"],
    transform: (row) => ({
      customer_id: row.customer ?? row.businessPartner,
      business_partner_id: row.businessPartner,
      business_partner_category: row.businessPartnerCategory,
      business_partner_grouping: row.businessPartnerGrouping,
      full_name: row.businessPartnerFullName,
      display_name: row.businessPartnerName ?? row.organizationBpName1,
      first_name: row.firstName,
      last_name: row.lastName,
      language_code: row.correspondenceLanguage,
      created_by_user: row.createdByUser,
      creation_date: parseDate(row.creationDate),
      last_change_date: parseDate(row.lastChangeDate),
      is_blocked: parseBoolean(row.businessPartnerIsBlocked),
      is_archived: parseBoolean(row.isMarkedForArchiving),
    }),
  },
  {
    tableName: "customer_company_assignments",
    sourceDir: "customer_company_assignments",
    columns: [
      "customer_id",
      "company_code",
      "customer_account_group",
      "reconciliation_account",
      "payment_terms",
      "payment_blocking_reason",
      "deletion_indicator",
    ],
    conflictColumns: ["customer_id", "company_code"],
    transform: (row) => ({
      customer_id: row.customer,
      company_code: row.companyCode,
      customer_account_group: row.customerAccountGroup,
      reconciliation_account: row.reconciliationAccount,
      payment_terms: row.paymentTerms,
      payment_blocking_reason: row.paymentBlockingReason,
      deletion_indicator: parseBoolean(row.deletionIndicator),
    }),
  },
  {
    tableName: "customer_sales_area_assignments",
    sourceDir: "customer_sales_area_assignments",
    columns: [
      "customer_id",
      "sales_organization",
      "distribution_channel",
      "division",
      "currency",
      "customer_payment_terms",
      "delivery_priority",
      "incoterms_classification",
      "incoterms_location1",
      "shipping_condition",
      "billing_blocked_for_customer",
    ],
    conflictColumns: ["customer_id", "sales_organization", "distribution_channel", "division"],
    transform: (row) => ({
      customer_id: row.customer,
      sales_organization: row.salesOrganization,
      distribution_channel: row.distributionChannel,
      division: row.division,
      currency: row.currency,
      customer_payment_terms: row.customerPaymentTerms,
      delivery_priority: row.deliveryPriority,
      incoterms_classification: row.incotermsClassification,
      incoterms_location1: row.incotermsLocation1,
      shipping_condition: row.shippingCondition,
      billing_blocked_for_customer: row.billingIsBlockedForCustomer,
    }),
  },
  {
    tableName: "products",
    sourceDir: "products",
    columns: [
      "product_id",
      "product_type",
      "product_old_id",
      "product_group",
      "base_unit",
      "division",
      "industry_sector",
      "gross_weight",
      "net_weight",
      "weight_unit",
      "creation_date",
      "created_by_user",
      "last_change_date",
      "last_change_datetime",
      "is_marked_for_deletion",
    ],
    conflictColumns: ["product_id"],
    transform: (row) => ({
      product_id: row.product,
      product_type: row.productType,
      product_old_id: row.productOldId,
      product_group: row.productGroup,
      base_unit: row.baseUnit,
      division: row.division,
      industry_sector: row.industrySector,
      gross_weight: parseNumber(row.grossWeight),
      net_weight: parseNumber(row.netWeight),
      weight_unit: row.weightUnit,
      creation_date: parseDate(row.creationDate),
      created_by_user: row.createdByUser,
      last_change_date: parseDate(row.lastChangeDate),
      last_change_datetime: parseDate(row.lastChangeDateTime),
      is_marked_for_deletion: parseBoolean(row.isMarkedForDeletion),
    }),
  },
  {
    tableName: "product_descriptions",
    sourceDir: "product_descriptions",
    columns: ["product_id", "language_code", "product_description"],
    conflictColumns: ["product_id", "language_code"],
    transform: (row) => ({
      product_id: row.product,
      language_code: row.language,
      product_description: row.productDescription,
    }),
  },
  {
    tableName: "sales_orders",
    sourceDir: "sales_order_headers",
    columns: [
      "sales_order_id",
      "sales_order_type",
      "sales_organization",
      "distribution_channel",
      "organization_division",
      "sales_group",
      "sales_office",
      "sold_to_customer_id",
      "creation_date",
      "created_by_user",
      "last_change_datetime",
      "total_net_amount",
      "overall_delivery_status",
      "overall_billing_status",
      "overall_reference_status",
      "transaction_currency",
      "pricing_date",
      "requested_delivery_date",
      "header_billing_block_reason",
      "delivery_block_reason",
      "incoterms_classification",
      "incoterms_location1",
      "customer_payment_terms",
      "total_credit_check_status",
    ],
    conflictColumns: ["sales_order_id"],
    transform: (row) => ({
      sales_order_id: row.salesOrder,
      sales_order_type: row.salesOrderType,
      sales_organization: row.salesOrganization,
      distribution_channel: row.distributionChannel,
      organization_division: row.organizationDivision,
      sales_group: row.salesGroup,
      sales_office: row.salesOffice,
      sold_to_customer_id: row.soldToParty,
      creation_date: parseDate(row.creationDate),
      created_by_user: row.createdByUser,
      last_change_datetime: parseDate(row.lastChangeDateTime),
      total_net_amount: parseNumber(row.totalNetAmount),
      overall_delivery_status: row.overallDeliveryStatus,
      overall_billing_status: row.overallOrdReltdBillgStatus,
      overall_reference_status: row.overallSdDocReferenceStatus,
      transaction_currency: row.transactionCurrency,
      pricing_date: parseDate(row.pricingDate),
      requested_delivery_date: parseDate(row.requestedDeliveryDate),
      header_billing_block_reason: row.headerBillingBlockReason,
      delivery_block_reason: row.deliveryBlockReason,
      incoterms_classification: row.incotermsClassification,
      incoterms_location1: row.incotermsLocation1,
      customer_payment_terms: row.customerPaymentTerms,
      total_credit_check_status: row.totalCreditCheckStatus,
    }),
  },
  {
    tableName: "sales_order_items",
    sourceDir: "sales_order_items",
    columns: [
      "sales_order_id",
      "sales_order_item_id",
      "sales_order_item_category",
      "product_id",
      "requested_quantity",
      "requested_quantity_unit",
      "transaction_currency",
      "net_amount",
      "material_group",
      "production_plant",
      "storage_location",
      "rejection_reason",
      "item_billing_block_reason",
    ],
    conflictColumns: ["sales_order_id", "sales_order_item_id"],
    transform: (row) => ({
      sales_order_id: row.salesOrder,
      sales_order_item_id: normalizeKey(row.salesOrderItem),
      sales_order_item_category: row.salesOrderItemCategory,
      product_id: row.material,
      requested_quantity: parseNumber(row.requestedQuantity),
      requested_quantity_unit: row.requestedQuantityUnit,
      transaction_currency: row.transactionCurrency,
      net_amount: parseNumber(row.netAmount),
      material_group: row.materialGroup,
      production_plant: row.productionPlant,
      storage_location: row.storageLocation,
      rejection_reason: row.salesDocumentRjcnReason,
      item_billing_block_reason: row.itemBillingBlockReason,
    }),
  },
  {
    tableName: "deliveries",
    sourceDir: "outbound_delivery_headers",
    columns: [
      "delivery_id",
      "actual_goods_movement_date",
      "creation_date",
      "delivery_block_reason",
      "general_incompletion_status",
      "header_billing_block_reason",
      "last_change_date",
      "overall_goods_movement_status",
      "overall_picking_status",
      "overall_proof_of_delivery_status",
      "shipping_point",
    ],
    conflictColumns: ["delivery_id"],
    transform: (row) => ({
      delivery_id: row.deliveryDocument,
      actual_goods_movement_date: parseDate(row.actualGoodsMovementDate),
      creation_date: parseDate(row.creationDate),
      delivery_block_reason: row.deliveryBlockReason,
      general_incompletion_status: row.hdrGeneralIncompletionStatus,
      header_billing_block_reason: row.headerBillingBlockReason,
      last_change_date: parseDate(row.lastChangeDate),
      overall_goods_movement_status: row.overallGoodsMovementStatus,
      overall_picking_status: row.overallPickingStatus,
      overall_proof_of_delivery_status: row.overallProofOfDeliveryStatus,
      shipping_point: row.shippingPoint,
    }),
  },
  {
    tableName: "delivery_items",
    sourceDir: "outbound_delivery_items",
    columns: [
      "delivery_id",
      "delivery_item_id",
      "sales_order_id",
      "sales_order_item_id",
      "actual_delivery_quantity",
      "delivery_quantity_unit",
      "batch",
      "plant",
      "storage_location",
      "item_billing_block_reason",
      "last_change_date",
    ],
    conflictColumns: ["delivery_id", "delivery_item_id"],
    transform: (row) => ({
      delivery_id: row.deliveryDocument,
      delivery_item_id: normalizeKey(row.deliveryDocumentItem),
      sales_order_id: row.referenceSdDocument,
      sales_order_item_id: normalizeKey(row.referenceSdDocumentItem),
      actual_delivery_quantity: parseNumber(row.actualDeliveryQuantity),
      delivery_quantity_unit: row.deliveryQuantityUnit,
      batch: row.batch,
      plant: row.plant,
      storage_location: row.storageLocation,
      item_billing_block_reason: row.itemBillingBlockReason,
      last_change_date: parseDate(row.lastChangeDate),
    }),
  },
  {
    tableName: "billing_documents",
    sourceDir: "billing_document_headers",
    columns: [
      "billing_document_id",
      "billing_document_type",
      "creation_date",
      "last_change_datetime",
      "billing_document_date",
      "is_cancelled",
      "cancelled_billing_document_id",
      "total_net_amount",
      "transaction_currency",
      "company_code",
      "fiscal_year",
      "accounting_document_id",
      "sold_to_customer_id",
    ],
    conflictColumns: ["billing_document_id"],
    transform: (row) => ({
      billing_document_id: row.billingDocument,
      billing_document_type: row.billingDocumentType,
      creation_date: parseDate(row.creationDate),
      last_change_datetime: parseDate(row.lastChangeDateTime),
      billing_document_date: parseDate(row.billingDocumentDate),
      is_cancelled: parseBoolean(row.billingDocumentIsCancelled),
      cancelled_billing_document_id: row.cancelledBillingDocument,
      total_net_amount: parseNumber(row.totalNetAmount),
      transaction_currency: row.transactionCurrency,
      company_code: row.companyCode,
      fiscal_year: row.fiscalYear,
      accounting_document_id: row.accountingDocument,
      sold_to_customer_id: row.soldToParty,
    }),
  },
  {
    tableName: "billing_document_items",
    sourceDir: "billing_document_items",
    columns: [
      "billing_document_id",
      "billing_document_item_id",
      "product_id",
      "billing_quantity",
      "billing_quantity_unit",
      "net_amount",
      "transaction_currency",
      "reference_delivery_id",
      "reference_delivery_item_id",
    ],
    conflictColumns: ["billing_document_id", "billing_document_item_id"],
    transform: (row) => ({
      billing_document_id: row.billingDocument,
      billing_document_item_id: normalizeKey(row.billingDocumentItem),
      product_id: row.material,
      billing_quantity: parseNumber(row.billingQuantity),
      billing_quantity_unit: row.billingQuantityUnit,
      net_amount: parseNumber(row.netAmount),
      transaction_currency: row.transactionCurrency,
      reference_delivery_id: row.referenceSdDocument,
      reference_delivery_item_id: normalizeKey(row.referenceSdDocumentItem),
    }),
  },
  {
    tableName: "journal_entries",
    sourceDir: "journal_entry_items_accounts_receivable",
    columns: [
      "company_code",
      "fiscal_year",
      "accounting_document_id",
      "accounting_document_item_id",
      "gl_account",
      "reference_document_id",
      "cost_center",
      "profit_center",
      "transaction_currency",
      "amount_in_transaction_currency",
      "company_code_currency",
      "amount_in_company_code_currency",
      "posting_date",
      "document_date",
      "accounting_document_type",
      "assignment_reference",
      "last_change_datetime",
      "customer_id",
      "financial_account_type",
      "clearing_date",
      "clearing_accounting_document",
      "clearing_doc_fiscal_year",
    ],
    conflictColumns: ["company_code", "fiscal_year", "accounting_document_id", "accounting_document_item_id"],
    transform: (row) => ({
      company_code: row.companyCode,
      fiscal_year: row.fiscalYear,
      accounting_document_id: row.accountingDocument,
      accounting_document_item_id: normalizeKey(row.accountingDocumentItem),
      gl_account: row.glAccount,
      reference_document_id: row.referenceDocument,
      cost_center: row.costCenter,
      profit_center: row.profitCenter,
      transaction_currency: row.transactionCurrency,
      amount_in_transaction_currency: parseNumber(row.amountInTransactionCurrency),
      company_code_currency: row.companyCodeCurrency,
      amount_in_company_code_currency: parseNumber(row.amountInCompanyCodeCurrency),
      posting_date: parseDate(row.postingDate),
      document_date: parseDate(row.documentDate),
      accounting_document_type: row.accountingDocumentType,
      assignment_reference: row.assignmentReference,
      last_change_datetime: parseDate(row.lastChangeDateTime),
      customer_id: row.customer,
      financial_account_type: row.financialAccountType,
      clearing_date: parseDate(row.clearingDate),
      clearing_accounting_document: row.clearingAccountingDocument,
      clearing_doc_fiscal_year: row.clearingDocFiscalYear,
    }),
  },
  {
    tableName: "payments_accounts_receivable",
    sourceDir: "payments_accounts_receivable",
    columns: [
      "company_code",
      "fiscal_year",
      "accounting_document_id",
      "accounting_document_item_id",
      "customer_id",
      "invoice_reference",
      "invoice_reference_fiscal_year",
      "sales_document_id",
      "sales_document_item_id",
      "clearing_date",
      "clearing_accounting_document",
      "clearing_doc_fiscal_year",
      "amount_in_transaction_currency",
      "transaction_currency",
      "amount_in_company_code_currency",
      "company_code_currency",
      "posting_date",
      "document_date",
      "assignment_reference",
      "gl_account",
      "financial_account_type",
      "profit_center",
      "cost_center",
    ],
    conflictColumns: ["company_code", "fiscal_year", "accounting_document_id", "accounting_document_item_id"],
    transform: (row) => ({
      company_code: row.companyCode,
      fiscal_year: row.fiscalYear,
      accounting_document_id: row.accountingDocument,
      accounting_document_item_id: normalizeKey(row.accountingDocumentItem),
      customer_id: row.customer,
      invoice_reference: row.invoiceReference,
      invoice_reference_fiscal_year: row.invoiceReferenceFiscalYear,
      sales_document_id: row.salesDocument,
      sales_document_item_id: normalizeKey(row.salesDocumentItem),
      clearing_date: parseDate(row.clearingDate),
      clearing_accounting_document: row.clearingAccountingDocument,
      clearing_doc_fiscal_year: row.clearingDocFiscalYear,
      amount_in_transaction_currency: parseNumber(row.amountInTransactionCurrency),
      transaction_currency: row.transactionCurrency,
      amount_in_company_code_currency: parseNumber(row.amountInCompanyCodeCurrency),
      company_code_currency: row.companyCodeCurrency,
      posting_date: parseDate(row.postingDate),
      document_date: parseDate(row.documentDate),
      assignment_reference: row.assignmentReference,
      gl_account: row.glAccount,
      financial_account_type: row.financialAccountType,
      profit_center: row.profitCenter,
      cost_center: row.costCenter,
    }),
  },
];

async function main() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is required in the environment.");
  }

  const client = new Client({ connectionString });
  await client.connect();

  try {
    const schemaSql = await fs.readFile(SCHEMA_FILE, "utf8");
    await client.query("BEGIN");
    await client.query(schemaSql);

    for (const loader of TABLE_LOADERS) {
      const sourcePath = path.join(DATA_DIR, loader.sourceDir);
      const files = await getDataFiles(sourcePath);
      let importedRows = 0;

      for (const file of files) {
        const rows = await readRecords(file);

        for (const row of rows) {
          const transformed = loader.transform(row);
          await upsertRow(client, loader.tableName, loader.columns, loader.conflictColumns, transformed);
          importedRows += 1;
        }
      }

      console.log(`Loaded ${importedRows} rows into ${loader.tableName}`);
    }

    await client.query("COMMIT");
    console.log("Order-to-cash import completed successfully.");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

async function getDataFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && (entry.name.endsWith(".jsonl") || entry.name.endsWith(".csv")))
    .map((entry) => path.join(dir, entry.name))
    .sort();
}

async function readRecords(filePath: string): Promise<Row[]> {
  if (filePath.endsWith(".jsonl")) {
    return readJsonLines(filePath);
  }

  if (filePath.endsWith(".csv")) {
    return readCsv(filePath);
  }

  throw new Error(`Unsupported file type: ${filePath}`);
}

async function readJsonLines(filePath: string): Promise<Row[]> {
  const rows: Row[] = [];
  const stream = createReadStream(filePath, { encoding: "utf8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    rows.push(JSON.parse(trimmed) as Row);
  }

  return rows;
}

async function readCsv(filePath: string): Promise<Row[]> {
  const rows: Row[] = [];

  await new Promise<void>((resolve, reject) => {
    createReadStream(filePath)
      .pipe(csvParser())
      .on("data", (data) => rows.push(data as Row))
      .on("end", () => resolve())
      .on("error", reject);
  });

  return rows;
}

async function upsertRow(
  client: Client,
  tableName: string,
  columns: string[],
  conflictColumns: string[],
  row: Row,
) {
  const values = columns.map((column) => normalizeValue(row[column]));
  const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ");
  const updates = columns
    .filter((column) => !conflictColumns.includes(column))
    .map((column) => `${column} = EXCLUDED.${column}`)
    .join(", ");

  const sql = `
    INSERT INTO ${tableName} (${columns.join(", ")})
    VALUES (${placeholders})
    ON CONFLICT (${conflictColumns.join(", ")})
    DO UPDATE SET ${updates};
  `;

  await client.query(sql, values);
}

function normalizeValue(value: unknown) {
  if (value === undefined || value === "") {
    return null;
  }

  return value;
}

function parseDate(value: unknown): string | null {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    return value;
  }

  return null;
}

function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseBoolean(value: unknown): boolean | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    if (value.toLowerCase() === "true") {
      return true;
    }
    if (value.toLowerCase() === "false") {
      return false;
    }
  }

  return null;
}

function normalizeKey(value: unknown): string | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  return String(value).replace(/^0+/, "") || "0";
}

main().catch((error) => {
  console.error("Import failed:", error);
  process.exitCode = 1;
});
