# Copyright (c) 2026, abu sayed and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class ProductionReport(Document):
	def validate(self):
		self.calculate_totals()

	def calculate_totals(self):
		total_production = 0
		total_wastage = 0
		for item in self.items:
			total_production += item.quantity_produced or 0
			total_wastage += item.wastage or 0
		self.total_production = total_production
		self.total_wastage = total_wastage
