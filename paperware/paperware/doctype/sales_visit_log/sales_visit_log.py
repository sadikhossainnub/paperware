# Copyright (c) 2026, abu sayed and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document

class SalesVisitLog(Document):
	def validate(self):
		if not self.user:
			self.user = frappe.session.user
		if not self.log_datetime:
			from frappe.utils import now_datetime
			self.log_datetime = now_datetime()
	
	def after_insert(self):
		# If log is Check-in or Check-out, update Sales Visit status?
		# Or maybe just record it.
		pass
