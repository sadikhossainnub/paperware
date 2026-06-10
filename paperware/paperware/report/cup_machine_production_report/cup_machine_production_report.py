# Copyright (c) 2026, abu sayed and contributors
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
			"fieldname": "machine_name",
			"label": _("Machine Name"),
			"fieldtype": "Link",
			"options": "Asset",
			"width": 180
		},
		{
			"fieldname": "customer",
			"label": _("Customer"),
			"fieldtype": "Link",
			"options": "Customer",
			"width": 140
		},
		{
			"fieldname": "customer_name",
			"label": _("Customer Name"),
			"fieldtype": "Data",
			"width": 160
		},
		{
			"fieldname": "total_produced",
			"label": _("Total Produced"),
			"fieldtype": "Int",
			"width": 140
		},
		{
			"fieldname": "total_wastage",
			"label": _("Total Wastage"),
			"fieldtype": "Int",
			"width": 140
		},
		{
			"fieldname": "net_production",
			"label": _("Net Production"),
			"fieldtype": "Int",
			"width": 140
		},
		{
			"fieldname": "entries",
			"label": _("No. of Entries"),
			"fieldtype": "Int",
			"width": 120
		}
	]


def get_data(filters):
	conditions = []
	values = {}

	if filters.get("from_date"):
		conditions.append("p.date >= %(from_date)s")
		values["from_date"] = filters.get("from_date")

	if filters.get("to_date"):
		conditions.append("p.date <= %(to_date)s")
		values["to_date"] = filters.get("to_date")

	if filters.get("shift"):
		conditions.append("p.shift = %(shift)s")
		values["shift"] = filters.get("shift")

	if filters.get("machine_name"):
		conditions.append("i.machine_name = %(machine_name)s")
		values["machine_name"] = filters.get("machine_name")

	if filters.get("customer"):
		conditions.append("i.customer = %(customer)s")
		values["customer"] = filters.get("customer")

	where_clause = " AND ".join(conditions) if conditions else "1=1"

	sql = f"""
		SELECT
			i.machine_name,
			i.customer,
			i.customer_name,
			SUM(i.quantity_produced) as total_produced,
			SUM(i.wastage) as total_wastage,
			SUM(i.net_production) as net_production,
			COUNT(*) as entries
		FROM
			`tabCup Machine Production Item` i
		INNER JOIN
			`tabCup Machine Production` p ON p.name = i.parent
		WHERE
			p.docstatus = 1 AND {where_clause}
		GROUP BY
			i.machine_name, i.customer
		ORDER BY
			i.machine_name ASC, i.customer ASC
	"""

	return frappe.db.sql(sql, values, as_dict=True)
