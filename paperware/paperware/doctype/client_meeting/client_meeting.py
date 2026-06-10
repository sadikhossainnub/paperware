# Copyright (c) 2026, Sayed and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe import _


class ClientMeeting(Document):
	def validate(self):
		if not self.created_by:
			self.created_by = frappe.session.user
		
		# Set default values if not set
		if not self.status:
			self.status = "Scheduled"

		# Handle start / end times based on status transition
		old_doc = self.get_doc_before_save()
		if old_doc and old_doc.status != self.status:
			from frappe.utils import now_datetime, nowdate, nowtime
			if self.status == "In Progress":
				if not self.meeting_start_time:
					self.meeting_start_time = now_datetime()
				if not self.attended_date:
					self.attended_date = nowdate()
				if not self.attended_time:
					self.attended_time = nowtime()
			elif self.status == "Completed" and not self.meeting_end_time:
				self.meeting_end_time = now_datetime()
				
			# Make sure we don't start a meeting that is completed
			# Validation can be added here if needed

	def on_submit(self):
		if self.status == "Scheduled":
			self.db_set("status", "Completed")

	def on_cancel(self):
		self.db_set("status", "Cancelled")
