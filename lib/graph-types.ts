export type GraphNode = {
  id: string;
  type: "customers" | "products" | "sales_orders" | "deliveries" | "billing_documents" | "journal_entries";
  label: string;
  subtitle?: string;
  color: string;
  val?: number;
  x?: number;
  y?: number;
};

export type GraphLink = {
  source: string;
  target: string;
  label: string;
};

export type GraphPayload = {
  nodes: GraphNode[];
  links: GraphLink[];
};

export type ChatTurn = {
  id: string;
  role: "user" | "assistant";
  content: string;
  referencedNodeIds?: string[];
  sql?: string[];
};
