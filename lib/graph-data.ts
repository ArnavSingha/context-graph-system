import { query } from "@/lib/db";
import type { GraphLink, GraphNode, GraphPayload } from "@/lib/graph-types";

type Row = Record<string, string | null>;

const COLORS: Record<GraphNode["type"], string> = {
  customers: "#0f766e",
  products: "#c96f2d",
  sales_orders: "#255a9b",
  deliveries: "#7c3aed",
  billing_documents: "#c2410c",
  journal_entries: "#475569",
};

function pushNode(nodes: GraphNode[], seen: Set<string>, node: GraphNode) {
  if (seen.has(node.id)) {
    return;
  }
  seen.add(node.id);
  nodes.push(node);
}

function pushLink(links: GraphLink[], seen: Set<string>, link: GraphLink) {
  const key = `${link.source}->${link.target}:${link.label}`;
  if (seen.has(key)) {
    return;
  }
  seen.add(key);
  links.push(link);
}

export async function getGraphPayload(): Promise<GraphPayload> {
  const [customers, products, salesOrders, deliveries, billingDocuments, journalEntries, orderProductEdges, orderDeliveryEdges, deliveryBillingEdges, billingJournalEdges] =
    await Promise.all([
      query<Row>("select customer_id, display_name from customers order by customer_id"),
      query<Row>(
        `select p.product_id, coalesce(pd.product_description, p.product_id) as label
         from products p
         left join product_descriptions pd
           on pd.product_id = p.product_id
          and pd.language_code = 'EN'
         order by p.product_id`,
      ),
      query<Row>(
        `select sales_order_id, sold_to_customer_id, total_net_amount
         from sales_orders
         order by sales_order_id`,
      ),
      query<Row>(
        `select delivery_id, shipping_point
         from deliveries
         order by delivery_id`,
      ),
      query<Row>(
        `select billing_document_id, sold_to_customer_id, total_net_amount
         from billing_documents
         order by billing_document_id`,
      ),
      query<Row>(
        `select company_code, fiscal_year, accounting_document_id, accounting_document_item_id, customer_id
         from journal_entries
         order by accounting_document_id, accounting_document_item_id`,
      ),
      query<Row>(
        `select distinct
            soi.sales_order_id,
            soi.product_id
         from sales_order_items soi
         where soi.product_id is not null`,
      ),
      query<Row>(
        `select distinct
            di.sales_order_id,
            di.delivery_id
         from delivery_items di
         where di.sales_order_id is not null`,
      ),
      query<Row>(
        `select distinct
            bdi.reference_delivery_id as delivery_id,
            bdi.billing_document_id
         from billing_document_items bdi
         where bdi.reference_delivery_id is not null`,
      ),
      query<Row>(
        `select distinct
            bd.billing_document_id,
            je.company_code,
            je.fiscal_year,
            je.accounting_document_id,
            je.accounting_document_item_id
         from billing_documents bd
         join journal_entries je
           on je.accounting_document_id = bd.accounting_document_id`,
      ),
    ]);

  const nodes: GraphNode[] = [];
  const links: GraphLink[] = [];
  const nodeSeen = new Set<string>();
  const linkSeen = new Set<string>();

  for (const row of customers.rows) {
    pushNode(nodes, nodeSeen, {
      id: `customers:${row.customer_id}`,
      type: "customers",
      label: row.display_name ?? row.customer_id ?? "Customer",
      subtitle: row.customer_id ?? undefined,
      color: COLORS.customers,
      val: 4,
    });
  }

  for (const row of products.rows) {
    pushNode(nodes, nodeSeen, {
      id: `products:${row.product_id}`,
      type: "products",
      label: row.label ?? row.product_id ?? "Product",
      subtitle: row.product_id ?? undefined,
      color: COLORS.products,
      val: 3,
    });
  }

  for (const row of salesOrders.rows) {
    const orderId = row.sales_order_id!;
    pushNode(nodes, nodeSeen, {
      id: `sales_orders:${orderId}`,
      type: "sales_orders",
      label: `Sales Order ${orderId}`,
      subtitle: row.total_net_amount ? `${row.total_net_amount}` : undefined,
      color: COLORS.sales_orders,
      val: 5,
    });
    if (row.sold_to_customer_id) {
      pushLink(links, linkSeen, {
        source: `sales_orders:${orderId}`,
        target: `customers:${row.sold_to_customer_id}`,
        label: "sold_to",
      });
    }
  }

  for (const row of deliveries.rows) {
    pushNode(nodes, nodeSeen, {
      id: `deliveries:${row.delivery_id}`,
      type: "deliveries",
      label: `Delivery ${row.delivery_id}`,
      subtitle: row.shipping_point ?? undefined,
      color: COLORS.deliveries,
      val: 4,
    });
  }

  for (const row of billingDocuments.rows) {
    const billingId = row.billing_document_id!;
    pushNode(nodes, nodeSeen, {
      id: `billing_documents:${billingId}`,
      type: "billing_documents",
      label: `Billing ${billingId}`,
      subtitle: row.total_net_amount ? `${row.total_net_amount}` : undefined,
      color: COLORS.billing_documents,
      val: 5,
    });
    if (row.sold_to_customer_id) {
      pushLink(links, linkSeen, {
        source: `billing_documents:${billingId}`,
        target: `customers:${row.sold_to_customer_id}`,
        label: "billed_to",
      });
    }
  }

  for (const row of journalEntries.rows) {
    const journalId = `journal_entries:${row.company_code}:${row.fiscal_year}:${row.accounting_document_id}:${row.accounting_document_item_id}`;
    pushNode(nodes, nodeSeen, {
      id: journalId,
      type: "journal_entries",
      label: `Journal ${row.accounting_document_id}-${row.accounting_document_item_id}`,
      subtitle: row.customer_id ?? undefined,
      color: COLORS.journal_entries,
      val: 2,
    });
    if (row.customer_id) {
      pushLink(links, linkSeen, {
        source: journalId,
        target: `customers:${row.customer_id}`,
        label: "customer_posting",
      });
    }
  }

  for (const row of orderProductEdges.rows) {
    pushLink(links, linkSeen, {
      source: `sales_orders:${row.sales_order_id}`,
      target: `products:${row.product_id}`,
      label: "contains",
    });
  }

  for (const row of orderDeliveryEdges.rows) {
    pushLink(links, linkSeen, {
      source: `deliveries:${row.delivery_id}`,
      target: `sales_orders:${row.sales_order_id}`,
      label: "fulfills",
    });
  }

  for (const row of deliveryBillingEdges.rows) {
    pushLink(links, linkSeen, {
      source: `billing_documents:${row.billing_document_id}`,
      target: `deliveries:${row.delivery_id}`,
      label: "bills",
    });
  }

  for (const row of billingJournalEdges.rows) {
    pushLink(links, linkSeen, {
      source: `journal_entries:${row.company_code}:${row.fiscal_year}:${row.accounting_document_id}:${row.accounting_document_item_id}`,
      target: `billing_documents:${row.billing_document_id}`,
      label: "posts",
    });
  }

  return { nodes, links };
}
