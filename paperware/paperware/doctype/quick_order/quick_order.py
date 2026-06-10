# Copyright (c) 2026, Sayed and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document

class QuickOrder(Document):
	def validate(self):
		self.calculate_total()
		
	def calculate_total(self):
		total = 0
		for item in self.items:
			if item.rate and item.qty:
				item.amount = item.rate * item.qty
				total += item.amount
		self.total_amount = total

	def on_submit(self):
		pass
