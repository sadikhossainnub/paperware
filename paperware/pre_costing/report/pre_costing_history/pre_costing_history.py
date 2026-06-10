# Copyright (c) 2026, Sayed and contributors
# For license information, please see license.txt

import frappe
from frappe import _


def execute(filters=None):
    columns = get_columns()
    data = get_data(filters)
    return columns, data


def get_columns():
    return [
        {
            "label": _("Pre Costing Order"),
            "fieldname": "name",
            "fieldtype": "Link",
            "options": "Pre Costing Order",
            "width": 120
        },
        {
            "label": _("Date"),
            "fieldname": "costing_date",
            "fieldtype": "Date",
            "width": 100
        },
        {
            "label": _("Customer"),
            "fieldname": "customer",
            "fieldtype": "Link",
            "options": "Customer",
            "width": 150
        },
        {
            "label": _("Item Type"),
            "fieldname": "item_type",
            "fieldtype": "Data",
            "width": 120
        },
        {
            "label": _("Finished Goods"),
            "fieldname": "fg_item",
            "fieldtype": "Link",
            "options": "Item",
            "width": 150
        },
        {
            "label": _("Quantity"),
            "fieldname": "target_qty",
            "fieldtype": "Int",
            "width": 80
        },
        {
            "label": _("Cost/Piece"),
            "fieldname": "cost_per_unit",
            "fieldtype": "Currency",
            "width": 100
        },
        {
            "label": _("Selling Rate"),
            "fieldname": "selling_rate",
            "fieldtype": "Currency",
            "width": 100
        },
        {
            "label": _("Total Cost"),
            "fieldname": "total_production_cost",
            "fieldtype": "Currency",
            "width": 100
        },
        {
            "label": _("Status"),
            "fieldname": "status",
            "fieldtype": "Data",
            "width": 80
        }
    ]


def get_data(filters=None):
    conditions = get_conditions(filters)
    
    data = frappe.db.sql(f"""
        SELECT
            name,
            costing_date,
            customer,
            item_type,
            fg_item,
            target_qty,
            cost_per_unit,
            selling_rate,
            total_production_cost,
            status
        FROM
            `tabPre Costing Order`
        WHERE
            docstatus = 1
            {conditions}
        ORDER BY
            creation DESC
    """, filters, as_dict=1)
    
    return data


def get_conditions(filters):
    conditions = ""
    
    if filters.get("customer"):
        conditions += "AND customer = %(customer)s"
    
    if filters.get("item_type"):
        conditions += "AND item_type = %(item_type)s"
    
    if filters.get("from_date") and filters.get("to_date"):
        conditions += "AND costing_date BETWEEN %(from_date)s AND %(to_date)s"
    
    return conditions
