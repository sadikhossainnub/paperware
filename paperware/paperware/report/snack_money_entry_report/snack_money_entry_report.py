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
			"fieldname": "employee",
			"label": _("Employee ID"),
			"fieldtype": "Link",
			"options": "Employee",
			"width": 120
		},
		{
			"fieldname": "employee_name",
			"label": _("Employee Name"),
			"fieldtype": "Data",
			"width": 180
		},
		{
			"fieldname": "date",
			"label": _("Date"),
			"fieldtype": "Date",
			"width": 100
		},
		{
			"fieldname": "start_time",
			"label": _("Start Time"),
			"fieldtype": "Time",
			"width": 100
		},
		{
			"fieldname": "end_time",
			"label": _("End Time"),
			"fieldtype": "Time",
			"width": 100
		},
		{
			"fieldname": "amount",
			"label": _("Amount"),
			"fieldtype": "Currency",
			"width": 120
		},
		{
			"fieldname": "remarks",
			"label": _("Remarks"),
			"fieldtype": "Data",
			"width": 180
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

	if filters.get("employee"):
		conditions.append("i.employee = %(employee)s")
		values["employee"] = filters.get("employee")

	if filters.get("company"):
		conditions.append("p.company = %(company)s")
		values["company"] = filters.get("company")

	where_clause = " AND ".join(conditions) if conditions else "1=1"

	sql = f"""
		SELECT
			i.employee,
			i.employee_name,
			p.date,
			i.start_time,
			i.end_time,
			i.amount,
			p.remarks
		FROM
			`tabSnack Money Entry Item` i
		INNER JOIN
			`tabSnack Money Entry` p ON p.name = i.parent
		WHERE
			p.docstatus = 1 AND {where_clause}
		ORDER BY
			p.date DESC, i.employee ASC
	"""

	return frappe.db.sql(sql, values, as_dict=True)
