# Copyright (c) 2026, abu sayed and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class CupMachineProduction(Document):
	def validate(self):
		self.calculate_net_production()
		self.calculate_grand_totals()

	def calculate_net_production(self):
		for item in self.items:
			item.net_production = (item.quantity_produced or 0) - (item.wastage or 0)

	def calculate_grand_totals(self):
		grand_total_production = 0
		grand_total_wastage = 0
		for item in self.items:
			grand_total_production += item.quantity_produced or 0
			grand_total_wastage += item.wastage or 0
		self.grand_total_production = grand_total_production
		self.grand_total_wastage = grand_total_wastage
