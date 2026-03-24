import "dotenv/config";

import { Client } from "pg";

type EntityType = "customer" | "sales-order" | "delivery" | "billing-document";

const entityType = parseEntityType(process.argv[2]);
const entityId = process.argv[3];

if (!entityType || !entityId) {
  printUsage();
  process.exitCode = 1;
} else {
  main(entityType, entityId).catch((error) => {
    console.error("Query failed:", error);
    process.exitCode = 1;
  });
}

async function main(type: EntityType, id: string) {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is required in the environment.");
  }

  const client = new Client({ connectionString });
  await client.connect();

  try {
    const payload =
      type === "customer"
        ? await fetchCustomerContext(client, id)
        : type === "sales-order"
          ? await fetchSalesOrderContext(client, id)
          : type === "delivery"
            ? await fetchDeliveryContext(client, id)
            : await fetchBillingDocumentContext(client, id);

    console.log(JSON.stringify(payload, null, 2));
  } finally {
    await client.end();
  }
}

async function fetchCustomerContext(client: Client, customerId: string) {
  const customer = await one(
    client,
    `
      select *
      from customers
      where customer_id = $1
    `,
    [customerId],
  );

  const companyAssignments = await many(
    client,
    `
      select *
      from customer_company_assignments
      where customer_id = $1
      order by company_code
    `,
    [customerId],
  );

  const salesAreaAssignments = await many(
    client,
    `
      select *
      from customer_sales_area_assignments
      where customer_id = $1
      order by sales_organization, distribution_channel, division
    `,
    [customerId],
  );

  const recentSalesOrders = await many(
    client,
    `
      select
        so.sales_order_id,
        so.creation_date,
        so.total_net_amount,
        so.transaction_currency,
        count(distinct soi.sales_order_item_id) as item_count,
        count(distinct di.delivery_id) as delivery_count,
        count(distinct bdi.billing_document_id) as billing_document_count
      from sales_orders so
      left join sales_order_items soi
        on soi.sales_order_id = so.sales_order_id
      left join delivery_items di
        on di.sales_order_id = soi.sales_order_id
       and di.sales_order_item_id = soi.sales_order_item_id
      left join billing_document_items bdi
        on bdi.reference_delivery_id = di.delivery_id
       and bdi.reference_delivery_item_id = di.delivery_item_id
      where so.sold_to_customer_id = $1
      group by so.sales_order_id, so.creation_date, so.total_net_amount, so.transaction_currency
      order by so.creation_date desc nulls last, so.sales_order_id desc
      limit 10
    `,
    [customerId],
  );

  return {
    lookup: { type: "customer", id: customerId },
    customer,
    companyAssignments,
    salesAreaAssignments,
    recentSalesOrders,
  };
}

async function fetchSalesOrderContext(client: Client, salesOrderId: string) {
  const header = await one(
    client,
    `
      select
        so.*,
        c.display_name as customer_name
      from sales_orders so
      left join customers c
        on c.customer_id = so.sold_to_customer_id
      where so.sales_order_id = $1
    `,
    [salesOrderId],
  );

  const items = await many(
    client,
    `
      select
        soi.*,
        pd.product_description
      from sales_order_items soi
      left join product_descriptions pd
        on pd.product_id = soi.product_id
       and pd.language_code = 'EN'
      where soi.sales_order_id = $1
      order by soi.sales_order_item_id
    `,
    [salesOrderId],
  );

  const deliveries = await many(
    client,
    `
      select distinct
        d.delivery_id,
        d.creation_date,
        d.actual_goods_movement_date,
        d.overall_goods_movement_status,
        d.shipping_point
      from delivery_items di
      join deliveries d
        on d.delivery_id = di.delivery_id
      where di.sales_order_id = $1
      order by d.creation_date nulls last, d.delivery_id
    `,
    [salesOrderId],
  );

  const billingDocuments = await many(
    client,
    `
      select distinct
        bd.billing_document_id,
        bd.billing_document_date,
        bd.total_net_amount,
        bd.transaction_currency,
        bd.accounting_document_id
      from delivery_items di
      join billing_document_items bdi
        on bdi.reference_delivery_id = di.delivery_id
       and bdi.reference_delivery_item_id = di.delivery_item_id
      join billing_documents bd
        on bd.billing_document_id = bdi.billing_document_id
      where di.sales_order_id = $1
      order by bd.billing_document_date nulls last, bd.billing_document_id
    `,
    [salesOrderId],
  );

  const payments = await many(
    client,
    `
      select distinct
        par.company_code,
        par.fiscal_year,
        par.accounting_document_id,
        par.accounting_document_item_id,
        par.clearing_date,
        par.amount_in_transaction_currency,
        par.transaction_currency,
        par.invoice_reference
      from delivery_items di
      join billing_document_items bdi
        on bdi.reference_delivery_id = di.delivery_id
       and bdi.reference_delivery_item_id = di.delivery_item_id
      join payments_accounts_receivable par
        on par.invoice_reference = bdi.billing_document_id
      where di.sales_order_id = $1
      order by par.clearing_date nulls last, par.accounting_document_id, par.accounting_document_item_id
    `,
    [salesOrderId],
  );

  return {
    lookup: { type: "sales-order", id: salesOrderId },
    header,
    items,
    deliveries,
    billingDocuments,
    payments,
  };
}

async function fetchDeliveryContext(client: Client, deliveryId: string) {
  const header = await one(
    client,
    `
      select *
      from deliveries
      where delivery_id = $1
    `,
    [deliveryId],
  );

  const items = await many(
    client,
    `
      select
        di.*,
        soi.product_id,
        pd.product_description
      from delivery_items di
      left join sales_order_items soi
        on soi.sales_order_id = di.sales_order_id
       and soi.sales_order_item_id = di.sales_order_item_id
      left join product_descriptions pd
        on pd.product_id = soi.product_id
       and pd.language_code = 'EN'
      where di.delivery_id = $1
      order by di.delivery_item_id
    `,
    [deliveryId],
  );

  const billingDocuments = await many(
    client,
    `
      select distinct
        bd.billing_document_id,
        bd.billing_document_date,
        bd.total_net_amount,
        bd.transaction_currency,
        bd.accounting_document_id
      from billing_document_items bdi
      join billing_documents bd
        on bd.billing_document_id = bdi.billing_document_id
      where bdi.reference_delivery_id = $1
      order by bd.billing_document_date nulls last, bd.billing_document_id
    `,
    [deliveryId],
  );

  return {
    lookup: { type: "delivery", id: deliveryId },
    header,
    items,
    billingDocuments,
  };
}

async function fetchBillingDocumentContext(client: Client, billingDocumentId: string) {
  const header = await one(
    client,
    `
      select
        bd.*,
        c.display_name as customer_name
      from billing_documents bd
      left join customers c
        on c.customer_id = bd.sold_to_customer_id
      where bd.billing_document_id = $1
    `,
    [billingDocumentId],
  );

  const items = await many(
    client,
    `
      select
        bdi.*,
        pd.product_description
      from billing_document_items bdi
      left join product_descriptions pd
        on pd.product_id = bdi.product_id
       and pd.language_code = 'EN'
      where bdi.billing_document_id = $1
      order by bdi.billing_document_item_id
    `,
    [billingDocumentId],
  );

  const journalEntries = await many(
    client,
    `
      select *
      from journal_entries
      where reference_document_id = $1
         or accounting_document_id = (
           select accounting_document_id
           from billing_documents
           where billing_document_id = $1
         )
      order by posting_date nulls last, accounting_document_item_id
    `,
    [billingDocumentId],
  );

  const payments = await many(
    client,
    `
      select *
      from payments_accounts_receivable
      where invoice_reference = $1
      order by clearing_date nulls last, accounting_document_id, accounting_document_item_id
    `,
    [billingDocumentId],
  );

  return {
    lookup: { type: "billing-document", id: billingDocumentId },
    header,
    items,
    journalEntries,
    payments,
  };
}

async function one(client: Client, sql: string, values: string[]) {
  const result = await client.query(sql, values);
  return result.rows[0] ?? null;
}

async function many(client: Client, sql: string, values: string[]) {
  const result = await client.query(sql, values);
  return result.rows;
}

function parseEntityType(value: string | undefined): EntityType | null {
  if (value === "customer" || value === "sales-order" || value === "delivery" || value === "billing-document") {
    return value;
  }

  return null;
}

function printUsage() {
  console.error("Usage: npm run query:o2c -- <customer|sales-order|delivery|billing-document> <id>");
}
