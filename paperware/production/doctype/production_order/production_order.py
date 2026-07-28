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

    def on_update(self):
        self.update_status()
        self.sync_delivery_date_to_sales_orders()

    def on_submit(self):
        self.update_status()
        self.sync_delivery_date_to_sales_orders()

    def update_status(self):
        """
        Auto-calculate and set Production Order status based on item_status
        of all child items.

        Rules:
          - docstatus == 2 (Cancelled)  → "Cancelled"  (never overwrite)
          - all items Draft             → "Pending"
          - all items Completed         → "Completed"
          - any item Failed             → "In Progress"
          - any item In Progress /
            QC Pending / Planned       → "In Progress"
          - mix of Completed + others  → "In Progress"
        """
        if self.docstatus == 2:
            # Already cancelled — don't touch
            return

        if not self.items:
            return

        statuses = {item.item_status for item in self.items}

        if statuses <= {"Draft"}:
            new_status = "Pending"
        elif statuses <= {"Completed"}:
            new_status = "Completed"
        else:
            new_status = "In Progress"

        if self.status != new_status:
            # Use db_set to avoid triggering recursive on_update
            self.db_set("status", new_status, notify=True, commit=False)

    def sync_delivery_date_to_sales_orders(self):
        """Update delivery_date on all linked Sales Orders when it changes."""
        if not self.delivery_date:
            return

        # Collect unique Sales Orders linked via items table
        sales_orders = list(set(
            item.sales_order for item in self.items if item.get("sales_order")
        ))

        if not sales_orders:
            return

        updated = []
        for so_name in sales_orders:
            current_date = frappe.db.get_value("Sales Order", so_name, "delivery_date")
            if str(current_date) != str(self.delivery_date):
                frappe.db.set_value(
                    "Sales Order", so_name, "delivery_date", self.delivery_date
                )
                updated.append(so_name)

        if updated:
            frappe.msgprint(
                _("Delivery date updated on Sales Order(s): {0}").format(
                    ", ".join(
                        frappe.utils.get_link_to_form("Sales Order", so)
                        for so in updated
                    )
                ),
                alert=True,
                indicator="blue",
            )


@frappe.whitelist()
def update_item_status(production_order, row_name, item_status):
    """
    Update a single Production Order Item's status and
    recalculate the parent Production Order status.
    Called from the frontend when a user changes item_status in the child table.
    """
    # Validate allowed values
    allowed = {"Draft", "Planned", "In Progress", "QC Pending", "Completed", "Failed"}
    if item_status not in allowed:
        frappe.throw(_("Invalid item status: {0}").format(item_status))

    # Update the child row directly
    frappe.db.set_value("Production Order Item", row_name, "item_status", item_status)

    # Reload the parent and recalculate status
    po = frappe.get_doc("Production Order", production_order)
    po.update_status()

    return po.status


@frappe.whitelist()
def make_production_order(source_name, target_doc=None):
    # Block if an active (non-cancelled) Production Order already exists for this Sales Order
    existing_po = frappe.db.get_value(
        "Production Order Item",
        {"sales_order": source_name},
        "parent",
        order_by="creation desc",
    )
    if existing_po:
        po_docstatus = frappe.db.get_value("Production Order", existing_po, "docstatus")
        if po_docstatus != 2:  # 2 = Cancelled
            frappe.throw(
                _("A Production Order {0} already exists for Sales Order {1}. "
                  "Cancel it first before creating a new one.").format(
                    frappe.utils.get_link_to_form("Production Order", existing_po),
                    frappe.utils.get_link_to_form("Sales Order", source_name),
                ),
                title=_("Duplicate Production Order"),
            )

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
                    "customer": "customer",
                    "delivery_date": "delivery_date",
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

    # Block if an active (non-cancelled) Production Order already exists for this Sales Order
    existing_item = frappe.db.get_value(
        "Production Order Item",
        {"sales_order": doc.name},
        ["parent"],
        order_by="creation desc",
        as_dict=True,
    )
    if existing_item:
        po_docstatus = frappe.db.get_value("Production Order", existing_item.parent, "docstatus")
        if po_docstatus != 2:  # 2 = Cancelled
            return

    po = frappe.new_doc("Production Order")
    po.company = doc.company
    po.customer = doc.customer
    po.date = frappe.utils.today()
    po.delivery_date = doc.delivery_date
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
