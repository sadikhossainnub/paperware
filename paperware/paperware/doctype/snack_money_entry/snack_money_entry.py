# Copyright (c) 2026, abu sayed and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class SnackMoneyEntry(Document):
	def validate(self):
		self.calculate_total()

	def calculate_total(self):
		total = 0
		for item in self.items:
			if item.amount and item.amount <= 0:
				frappe.throw(f"Row {item.idx}: Amount must be greater than zero.")
			total += item.amount or 0
		self.total_amount = total
