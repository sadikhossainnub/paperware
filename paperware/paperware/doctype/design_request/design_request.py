# Copyright (c) 2026, Sayed and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document

class DesignRequest(Document):
	def validate(self):
		pass
			
	def on_submit(self):
		if self.status == "Pending":
			self.db_set("status", "In Progress")
