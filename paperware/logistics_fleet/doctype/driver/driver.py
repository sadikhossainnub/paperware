import frappe
from frappe.model.document import Document
from frappe import _
import re

class Driver(Document):
	def validate(self):
		if self.phone:
			self.validate_phone()

	def validate_phone(self):
		if not re.match(r"^\+?[\d\s\-]{10,15}$", self.phone):
			frappe.throw(_("Please enter a valid phone number"))
