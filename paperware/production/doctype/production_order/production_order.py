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
                "condition": lambda doc: doc.is_stock_item == 1,
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
            # Skip service items (non-stock items)
            if not item.is_stock_item:
                continue

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


@frappe.whitelist()
def make_material_request(source_name, target_doc=None):
    """Create a Material Request from a submitted Production Order."""

    production_order = frappe.get_doc("Production Order", source_name)

    if production_order.docstatus != 1:
        frappe.throw(_("Material Request can only be created from a submitted Production Order"))

    def set_missing_values(source, target):
        target.material_request_type = "Purchase"
        target.schedule_date = source.date

    def update_item(source_item, target_item, source_parent):
        target_item.qty = source_item.qty_to_produce
        target_item.schedule_date = source_item.delivery_date or source_parent.date
        target_item.sales_order = source_item.sales_order

    doclist = get_mapped_doc(
        "Production Order",
        source_name,
        {
            "Production Order": {
                "doctype": "Material Request",
                "field_map": {
                    "company": "company",
                },
                "validation": {
                    "docstatus": ["=", 1]
                },
            },
            "Production Order Item": {
                "doctype": "Material Request Item",
                "field_map": {
                    "item_code": "item_code",
                    "item_name": "item_name",
                    "description": "description",
                    "uom": "uom",
                    "qty_to_produce": "qty",
                },
                "postprocess": update_item,
            },
        },
        target_doc,
        postprocess=set_missing_values,
    )

    return doclist


def auto_create_production_order(doc, method):
    """Automatically create a Production Order when a Sales Order is submitted."""

    # Check if there are any stock items in the Sales Order
    stock_items = [item for item in doc.items if item.is_stock_item]
    if not stock_items:
        return

    # Check if a Production Order already exists for this Sales Order
    existing = frappe.db.exists("Production Order Item", {"sales_order": doc.name})
    if existing:
        return

    po = frappe.new_doc("Production Order")
    po.company = doc.company
    po.date = frappe.utils.today()
    po.status = "Pending"

    for item in stock_items:
        po.append("items", {
            "item_code":       item.item_code,
            "item_name":       item.item_name,
            "description":     item.description,
            "sales_order":     doc.name,
            "customer":        doc.customer,
            "customer_name":   doc.customer_name,
            "delivery_date":   doc.delivery_date,
            "sales_order_qty": item.qty,
            "qty_to_produce":  item.qty,
            "uom":             item.uom,
            "priority_level":  "Medium",
            "item_status":     "Draft",
        })

    po.flags.ignore_permissions = True
    po.insert()
    po.submit()

    frappe.msgprint(
        _("Production Order {0} created automatically").format(
            frappe.utils.get_link_to_form("Production Order", po.name)
        ),
        alert=True,
        indicator="green",
    )
