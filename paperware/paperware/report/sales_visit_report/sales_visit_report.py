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
			"fieldname": "visit_date",
			"label": _("Date"),
			"fieldtype": "Date",
			"width": 100
		},
		{
			"fieldname": "client_name",
			"label": _("Client"),
			"fieldtype": "Link",
			"options": "Customer",
			"width": 150
		},
		{
			"fieldname": "purpose",
			"label": _("Purpose"),
			"fieldtype": "Data",
			"width": 120
		},
		{
			"fieldname": "location_name",
			"label": _("Location"),
			"fieldtype": "Data",
			"width": 150
		},
		{
			"fieldname": "notes",
			"label": _("Notes"),
			"fieldtype": "Small Text",
			"width": 200
		},
		{
			"fieldname": "status",
			"label": _("Status"),
			"fieldtype": "Data",
			"width": 100
		},
		{
			"fieldname": "created_by",
			"label": _("User"),
			"fieldtype": "Link",
			"options": "User",
			"width": 120
		}
	]

def get_data(filters):
	conditions = []
	values = {}
	
	if filters.get("from_date"):
		conditions.append("visit_date >= %(from_date)s")
		values["from_date"] = filters.get("from_date")
		
	if filters.get("to_date"):
		conditions.append("visit_date <= %(to_date)s")
		values["to_date"] = filters.get("to_date")
		
	if filters.get("user"):
		conditions.append("created_by = %(user)s")
		values["user"] = filters.get("user")
		
	if filters.get("purpose"):
		conditions.append("purpose = %(purpose)s")
		values["purpose"] = filters.get("purpose")
	
	where_clause = " AND ".join(conditions) if conditions else "1=1"
	
	sql = f"""
		SELECT
			visit_date, client_name, purpose, location_name, notes, status, created_by
		FROM
			`tabSales Visit`
		WHERE
			{where_clause}
		ORDER BY
			visit_date DESC
	"""
	
	return frappe.db.sql(sql, values, as_dict=True)
