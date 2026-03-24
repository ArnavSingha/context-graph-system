CREATE TABLE IF NOT EXISTS customers (
  customer_id TEXT PRIMARY KEY,
  business_partner_id TEXT,
  business_partner_category TEXT,
  business_partner_grouping TEXT,
  full_name TEXT,
  display_name TEXT,
  first_name TEXT,
  last_name TEXT,
  language_code TEXT,
  created_by_user TEXT,
  creation_date TIMESTAMPTZ,
  last_change_date TIMESTAMPTZ,
  is_blocked BOOLEAN,
  is_archived BOOLEAN
);

CREATE TABLE IF NOT EXISTS customer_company_assignments (
  customer_id TEXT NOT NULL REFERENCES customers(customer_id),
  company_code TEXT NOT NULL,
  customer_account_group TEXT,
  reconciliation_account TEXT,
  payment_terms TEXT,
  payment_blocking_reason TEXT,
  deletion_indicator BOOLEAN,
  PRIMARY KEY (customer_id, company_code)
);

CREATE TABLE IF NOT EXISTS customer_sales_area_assignments (
  customer_id TEXT NOT NULL REFERENCES customers(customer_id),
  sales_organization TEXT NOT NULL,
  distribution_channel TEXT NOT NULL,
  division TEXT NOT NULL,
  currency TEXT,
  customer_payment_terms TEXT,
  delivery_priority TEXT,
  incoterms_classification TEXT,
  incoterms_location1 TEXT,
  shipping_condition TEXT,
  billing_blocked_for_customer TEXT,
  PRIMARY KEY (customer_id, sales_organization, distribution_channel, division)
);

CREATE TABLE IF NOT EXISTS products (
  product_id TEXT PRIMARY KEY,
  product_type TEXT,
  product_old_id TEXT,
  product_group TEXT,
  base_unit TEXT,
  division TEXT,
  industry_sector TEXT,
  gross_weight NUMERIC(18, 3),
  net_weight NUMERIC(18, 3),
  weight_unit TEXT,
  creation_date TIMESTAMPTZ,
  created_by_user TEXT,
  last_change_date TIMESTAMPTZ,
  last_change_datetime TIMESTAMPTZ,
  is_marked_for_deletion BOOLEAN
);

CREATE TABLE IF NOT EXISTS product_descriptions (
  product_id TEXT NOT NULL REFERENCES products(product_id),
  language_code TEXT NOT NULL,
  product_description TEXT,
  PRIMARY KEY (product_id, language_code)
);

CREATE TABLE IF NOT EXISTS sales_orders (
  sales_order_id TEXT PRIMARY KEY,
  sales_order_type TEXT,
  sales_organization TEXT,
  distribution_channel TEXT,
  organization_division TEXT,
  sales_group TEXT,
  sales_office TEXT,
  sold_to_customer_id TEXT REFERENCES customers(customer_id),
  creation_date TIMESTAMPTZ,
  created_by_user TEXT,
  last_change_datetime TIMESTAMPTZ,
  total_net_amount NUMERIC(18, 2),
  overall_delivery_status TEXT,
  overall_billing_status TEXT,
  overall_reference_status TEXT,
  transaction_currency TEXT,
  pricing_date TIMESTAMPTZ,
  requested_delivery_date TIMESTAMPTZ,
  header_billing_block_reason TEXT,
  delivery_block_reason TEXT,
  incoterms_classification TEXT,
  incoterms_location1 TEXT,
  customer_payment_terms TEXT,
  total_credit_check_status TEXT
);

CREATE TABLE IF NOT EXISTS sales_order_items (
  sales_order_id TEXT NOT NULL REFERENCES sales_orders(sales_order_id),
  sales_order_item_id TEXT NOT NULL,
  sales_order_item_category TEXT,
  product_id TEXT REFERENCES products(product_id),
  requested_quantity NUMERIC(18, 3),
  requested_quantity_unit TEXT,
  transaction_currency TEXT,
  net_amount NUMERIC(18, 2),
  material_group TEXT,
  production_plant TEXT,
  storage_location TEXT,
  rejection_reason TEXT,
  item_billing_block_reason TEXT,
  PRIMARY KEY (sales_order_id, sales_order_item_id)
);

CREATE TABLE IF NOT EXISTS deliveries (
  delivery_id TEXT PRIMARY KEY,
  actual_goods_movement_date TIMESTAMPTZ,
  creation_date TIMESTAMPTZ,
  delivery_block_reason TEXT,
  general_incompletion_status TEXT,
  header_billing_block_reason TEXT,
  last_change_date TIMESTAMPTZ,
  overall_goods_movement_status TEXT,
  overall_picking_status TEXT,
  overall_proof_of_delivery_status TEXT,
  shipping_point TEXT
);

CREATE TABLE IF NOT EXISTS delivery_items (
  delivery_id TEXT NOT NULL REFERENCES deliveries(delivery_id),
  delivery_item_id TEXT NOT NULL,
  sales_order_id TEXT,
  sales_order_item_id TEXT,
  actual_delivery_quantity NUMERIC(18, 3),
  delivery_quantity_unit TEXT,
  batch TEXT,
  plant TEXT,
  storage_location TEXT,
  item_billing_block_reason TEXT,
  last_change_date TIMESTAMPTZ,
  PRIMARY KEY (delivery_id, delivery_item_id),
  FOREIGN KEY (sales_order_id, sales_order_item_id)
    REFERENCES sales_order_items(sales_order_id, sales_order_item_id)
);

CREATE TABLE IF NOT EXISTS billing_documents (
  billing_document_id TEXT PRIMARY KEY,
  billing_document_type TEXT,
  creation_date TIMESTAMPTZ,
  last_change_datetime TIMESTAMPTZ,
  billing_document_date TIMESTAMPTZ,
  is_cancelled BOOLEAN,
  cancelled_billing_document_id TEXT,
  total_net_amount NUMERIC(18, 2),
  transaction_currency TEXT,
  company_code TEXT,
  fiscal_year TEXT,
  accounting_document_id TEXT,
  sold_to_customer_id TEXT REFERENCES customers(customer_id)
);

CREATE TABLE IF NOT EXISTS billing_document_items (
  billing_document_id TEXT NOT NULL REFERENCES billing_documents(billing_document_id),
  billing_document_item_id TEXT NOT NULL,
  product_id TEXT REFERENCES products(product_id),
  billing_quantity NUMERIC(18, 3),
  billing_quantity_unit TEXT,
  net_amount NUMERIC(18, 2),
  transaction_currency TEXT,
  reference_delivery_id TEXT,
  reference_delivery_item_id TEXT,
  PRIMARY KEY (billing_document_id, billing_document_item_id),
  FOREIGN KEY (reference_delivery_id, reference_delivery_item_id)
    REFERENCES delivery_items(delivery_id, delivery_item_id)
);

CREATE TABLE IF NOT EXISTS journal_entries (
  company_code TEXT NOT NULL,
  fiscal_year TEXT NOT NULL,
  accounting_document_id TEXT NOT NULL,
  accounting_document_item_id TEXT NOT NULL,
  gl_account TEXT,
  reference_document_id TEXT,
  cost_center TEXT,
  profit_center TEXT,
  transaction_currency TEXT,
  amount_in_transaction_currency NUMERIC(18, 2),
  company_code_currency TEXT,
  amount_in_company_code_currency NUMERIC(18, 2),
  posting_date TIMESTAMPTZ,
  document_date TIMESTAMPTZ,
  accounting_document_type TEXT,
  assignment_reference TEXT,
  last_change_datetime TIMESTAMPTZ,
  customer_id TEXT REFERENCES customers(customer_id),
  financial_account_type TEXT,
  clearing_date TIMESTAMPTZ,
  clearing_accounting_document TEXT,
  clearing_doc_fiscal_year TEXT,
  PRIMARY KEY (company_code, fiscal_year, accounting_document_id, accounting_document_item_id)
);

CREATE TABLE IF NOT EXISTS payments_accounts_receivable (
  company_code TEXT NOT NULL,
  fiscal_year TEXT NOT NULL,
  accounting_document_id TEXT NOT NULL,
  accounting_document_item_id TEXT NOT NULL,
  customer_id TEXT REFERENCES customers(customer_id),
  invoice_reference TEXT,
  invoice_reference_fiscal_year TEXT,
  sales_document_id TEXT,
  sales_document_item_id TEXT,
  clearing_date TIMESTAMPTZ,
  clearing_accounting_document TEXT,
  clearing_doc_fiscal_year TEXT,
  amount_in_transaction_currency NUMERIC(18, 2),
  transaction_currency TEXT,
  amount_in_company_code_currency NUMERIC(18, 2),
  company_code_currency TEXT,
  posting_date TIMESTAMPTZ,
  document_date TIMESTAMPTZ,
  assignment_reference TEXT,
  gl_account TEXT,
  financial_account_type TEXT,
  profit_center TEXT,
  cost_center TEXT,
  PRIMARY KEY (company_code, fiscal_year, accounting_document_id, accounting_document_item_id),
  FOREIGN KEY (company_code, fiscal_year, accounting_document_id, accounting_document_item_id)
    REFERENCES journal_entries(company_code, fiscal_year, accounting_document_id, accounting_document_item_id)
);
