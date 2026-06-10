# Copyright (c) 2026, abu sayed and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import time_diff_in_hours


class DutyTimeEntry(Document):
	def validate(self):
		self.calculate_total_hours()

	def calculate_total_hours(self):
		if self.start_time and self.end_time:
			hours = time_diff_in_hours(self.end_time, self.start_time)
			if hours < 0:
				hours += 24  # handle overnight shifts
			self.total_hours = round(hours, 2)
