# Copyright (c) 2026, abu sayed and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.model.mapper import get_mapped_doc
from frappe import _


class ProductionOrder(Document):
    def validate(self):
        if not self.items:
            frappe.throw(_("Items table cannot be empty"))

        for item in self.items:
            if not item.qty_to_produce or item.qty_to_produce <= 0:
                frappe.throw(
                    _("Quantity to produce for item {0} must be greater than 0").format(item.item_code)
                )


@frappe.whitelist()
def make_production_order(source_name, target_doc=None):
    def update_item_fields(source, target):
        for item in target.items:
            item.sales_order = source.name
            item.customer = source.customer
            item.customer_name = source.customer_name
            item.delivery_date = source.delivery_date

    doclist = get_mapped_doc(
        "Sales Order",
        source_name,
        {
            "Sales Order": {
                "doctype": "Production Order",
                "field_map": {
                    "company": "company",
                },
            },
            "Sales Order Item": {
                "doctype": "Production Order Item",
                "field_map": {
                    "item_code": "item_code",
                    "item_name": "item_name",
                    "description": "description",
                    "qty": "sales_order_qty",
                    "uom": "uom",
                },
                "postprocess": lambda source, target, source_parent: setattr(target, "qty_to_produce", source.qty),
            },
        },
        target_doc,
        postprocess=update_item_fields,
    )

    return doclist


@frappe.whitelist()
def get_items_from_sales_orders(sales_orders):
    import json

    if isinstance(sales_orders, str):
        sales_orders = json.loads(sales_orders)

    all_items = []
    first_company = None

    for so_name in sales_orders:
        so = frappe.get_doc("Sales Order", so_name)

        if not first_company:
            first_company = so.company

        for item in so.items:
            all_items.append({
                "sales_order":     so.name,
                "customer":        so.customer,
                "customer_name":   so.customer_name,
                "delivery_date":   str(so.delivery_date) if so.delivery_date else None,
                "item_code":       item.item_code,
                "item_name":       item.item_name,
                "description":     item.description,
                "sales_order_qty": item.qty,
                "qty_to_produce":  item.qty,
                "uom":             item.uom,
                "priority_level":  "Medium",
                "item_status":     "Draft",
            })

    return {"items": all_items, "company": first_company}
