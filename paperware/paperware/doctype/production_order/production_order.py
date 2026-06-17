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
    doclist = get_mapped_doc(
        "Sales Order",
        source_name,
        {
            "Sales Order": {
                "doctype": "Production Order",
                "field_map": {
                    "name": "sales_order",
                    "customer": "customer",
                    "customer_name": "customer_name",
                    "delivery_date": "delivery_date",
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
                "postprocess": lambda source, target: setattr(target, "qty_to_produce", source.qty),
            },
        },
        target_doc,
    )

    return doclist
