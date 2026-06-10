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
			"label": _("Delivery Note"),
			"fieldtype": "Link",
			"options": "Delivery Note",
			"width": 140
		},
		{
			"fieldname": "customer",
			"label": _("Customer"),
			"fieldtype": "Link",
			"options": "Customer",
			"width": 140
		},
		{
			"fieldname": "posting_date",
			"label": _("Date"),
			"fieldtype": "Date",
			"width": 100
		},
		{
			"fieldname": "grand_total",
			"label": _("Grand Total"),
			"fieldtype": "Currency",
			"width": 120
		},
		{
			"fieldname": "status",
			"label": _("Status"),
			"fieldtype": "Data",
			"width": 100
		},
		{
			"fieldname": "driver_name",
			"label": _("Driver"),
			"fieldtype": "Data",
			"width": 140
		},
		{
			"fieldname": "delivery_time",
			"label": _("Delivery Time (Hrs)"),
			"fieldtype": "Float",
			"width": 120
		}
	]

def get_data(filters):
	conditions = []
	values = {}
	
	if filters.get("from_date"):
		conditions.append("posting_date >= %(from_date)s")
		values["from_date"] = filters.get("from_date")
		
	if filters.get("to_date"):
		conditions.append("posting_date <= %(to_date)s")
		values["to_date"] = filters.get("to_date")
		
	where_clause = " AND ".join(conditions) if conditions else "1=1"
	
	# Attempting to fetch standard Delivery Note fields + driver (custom field assumption)
	# If driver_name doesn't exist, this might error in a real system unless we add it to the query conditionally
	# using a safe select or just standard fields.
	
	sql = f"""
		SELECT
			name, customer, posting_date, grand_total, status, 
			'' as driver_name, 
			0 as delivery_time
		FROM
			`tabDelivery Note`
		WHERE
			{where_clause}
		ORDER BY
			posting_date DESC
	"""
	
	return frappe.db.sql(sql, values, as_dict=True)
