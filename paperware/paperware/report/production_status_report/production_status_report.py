# Copyright (c) 2026, Sayed and contributors
# For license information, please see license.txt

import frappe
from frappe import _

def execute(filters=None):
	columns, data = [], []
	
	columns = get_columns()
	data = get_data(filters)
	
	return columns, data

def get_columns():
	return [
		{
			"fieldname": "name",
			"label": _("ID"),
			"fieldtype": "Link",
			"options": "Production Details",
			"width": 120
		},
		{
			"fieldname": "sales_order",
			"label": _("Sales Order"),
			"fieldtype": "Link",
			"options": "Sales Order",
			"width": 120
		},
		{
			"fieldname": "item_code",
			"label": _("Item"),
			"fieldtype": "Link",
			"options": "Item",
			"width": 120
		},
		{
			"fieldname": "production_status",
			"label": _("Status"),
			"fieldtype": "Data",
			"width": 120
		},
		{
			"fieldname": "progress",
			"label": _("Progress (%)"),
			"fieldtype": "Percent",
			"width": 100
		},
		{
			"fieldname": "machine_assigned",
			"label": _("Machine"),
			"fieldtype": "Data",
			"width": 120
		},
		{
			"fieldname": "operator",
			"label": _("Operator"),
			"fieldtype": "Link",
			"options": "User",
			"width": 120
		},
		{
			"fieldname": "quality_check_status",
			"label": _("QC Status"),
			"fieldtype": "Data",
			"width": 100
		}
	]

def get_data(filters):
	conditions = []
	values = {}
	
	if filters.get("status"):
		conditions.append("production_status = %(status)s")
		values["status"] = filters.get("status")
		
	if filters.get("sales_order"):
		conditions.append("sales_order = %(sales_order)s")
		values["sales_order"] = filters.get("sales_order")
		
	if filters.get("machine"):
		conditions.append("machine_assigned = %(machine)s")
		values["machine"] = filters.get("machine")

	where_clause = " AND ".join(conditions) if conditions else "1=1"
	
	sql = f"""
		SELECT
			name, sales_order, item_code, production_status, progress, 
			machine_assigned, operator, quality_check_status
		FROM
			`tabProduction Details`
		WHERE
			{where_clause}
		ORDER BY
			creation DESC
	"""
	
	return frappe.db.sql(sql, values, as_dict=True)
