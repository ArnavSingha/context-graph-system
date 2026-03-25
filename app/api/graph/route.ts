import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";

type GraphRow = {
  sales_order_id: string;
  creation_date: string | null;
  sold_to_customer_id: string | null;
  customer_name: string | null;
  delivery_id: string | null;
  billing_document_id: string | null;
};

type GraphNode = {
  id: string;
  label: string;
  group: "customer" | "sales_order" | "delivery" | "billing_document";
};

type GraphLink = {
  source: string;
  target: string;
  label: string;
};

export async function GET() {
  let client;

  try {
    client = await getPool().connect();

    const result = await client.query<GraphRow>(`
      with recent_sales_orders as (
        select
          so.sales_order_id,
          so.creation_date,
          so.sold_to_customer_id
        from sales_orders so
        order by so.creation_date desc nulls last, so.sales_order_id desc
        limit 50
      )
      select
        rso.sales_order_id,
        rso.creation_date::text,
        rso.sold_to_customer_id,
        c.display_name as customer_name,
        di.delivery_id,
        bdi.billing_document_id
      from recent_sales_orders rso
      left join customers c
        on c.customer_id = rso.sold_to_customer_id
      left join delivery_items di
        on di.sales_order_id = rso.sales_order_id
      left join billing_document_items bdi
        on bdi.reference_delivery_id = di.delivery_id
       and bdi.reference_delivery_item_id = di.delivery_item_id
      order by rso.creation_date desc nulls last, rso.sales_order_id desc
    `);

    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];
    const nodeSeen = new Set<string>();
    const linkSeen = new Set<string>();

    const addNode = (node: GraphNode) => {
      if (nodeSeen.has(node.id)) {
        return;
      }
      nodeSeen.add(node.id);
      nodes.push(node);
    };

    const addLink = (link: GraphLink) => {
      const key = `${link.source}->${link.target}:${link.label}`;
      if (linkSeen.has(key)) {
        return;
      }
      linkSeen.add(key);
      links.push(link);
    };

    for (const row of result.rows) {
      const salesOrderNodeId = `order_${row.sales_order_id}`;

      addNode({
        id: salesOrderNodeId,
        label: `Sales Order ${row.sales_order_id}`,
        group: "sales_order",
      });

      if (row.sold_to_customer_id) {
        const customerNodeId = `cust_${row.sold_to_customer_id}`;

        addNode({
          id: customerNodeId,
          label: row.customer_name ?? `Customer ${row.sold_to_customer_id}`,
          group: "customer",
        });

        addLink({
          source: salesOrderNodeId,
          target: customerNodeId,
          label: "placed_by",
        });
      }

      if (row.delivery_id) {
        const deliveryNodeId = `delivery_${row.delivery_id}`;

        addNode({
          id: deliveryNodeId,
          label: `Delivery ${row.delivery_id}`,
          group: "delivery",
        });

        addLink({
          source: deliveryNodeId,
          target: salesOrderNodeId,
          label: "fulfills",
        });

        if (row.billing_document_id) {
          const billingNodeId = `billing_${row.billing_document_id}`;

          addNode({
            id: billingNodeId,
            label: `Invoice ${row.billing_document_id}`,
            group: "billing_document",
          });

          addLink({
            source: billingNodeId,
            target: deliveryNodeId,
            label: "bills",
          });
        }
      }
    }

    return NextResponse.json({ nodes, links });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to build graph payload.";
    // Log the error for Netlify function logs without leaking secrets.
    console.error("api/graph error:", message);
    return NextResponse.json(
      {
        error: message,
      },
      { status: 500 },
    );
  } finally {
    client?.release();
  }
}
