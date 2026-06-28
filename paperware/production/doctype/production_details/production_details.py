# Copyright (c) 2026, Sayed and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import now_datetime

class ProductionDetails(Document):
	def validate(self):
		if self.production_status == "Completed" and not self.end_time:
			self.end_time = now_datetime()
			self.progress = 100
			
		if self.production_status == "In Progress" and not self.start_time:
			self.start_time = now_datetime()
			
	def on_submit(self):
		if self.production_status != "Completed":
			self.production_status = "Completed"
			self.progress = 100
			self.end_time = now_datetime()
		
		# Update progress on related Sales Order Item if possible? 
		# Keeping it simple for now.
