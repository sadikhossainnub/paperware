import frappe
from frappe.model.document import Document

class MaintenanceLog(Document):
	def validate(self):
		self.calculate_total_cost()

	def calculate_total_cost(self):
		total = 0
		for item in self.get("items"):
			item.amount = (item.quantity or 0) * (item.rate or 0)
			total += item.amount
		self.cost = total
