# Copyright (c) 2024, abu sayed and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class ProductionUnitAssignment(Document):
	"""
	Production Unit Assignment DocType for tracking work distribution across manufacturing stations.
	
	This child table tracks the assignment of Production Order Items to specific production units
	(Printing, Die Cutting, Cup Forming, Lamination, Packing, QC) along with worker, operator,
	and machine assignments, progress tracking, and completion details.
	
	Unit Status Lifecycle: Pending → In Progress → Completed/Rejected
	
	Requirements Validated: 4.1, 4.2, 5.1
	"""
	
	def validate(self):
		"""
		Validate Production Unit Assignment before saving.
		Ensures data integrity and business rule compliance.
		"""
		self.validate_dates()
		self.validate_progress()
		self.validate_completion()
	
	def validate_dates(self):
		"""
		Validate that dates are logical.
		- assigned_date should be before or equal to expected_completion_date
		- completion_date should be after or equal to assigned_date
		"""
		if self.assigned_date and self.expected_completion_date:
			if self.assigned_date > self.expected_completion_date:
				frappe.throw("Assigned Date cannot be after Expected Completion Date")
		
		if self.completion_date and self.assigned_date:
			if self.completion_date < self.assigned_date:
				frappe.throw("Completion Date cannot be before Assigned Date")
	
	def validate_progress(self):
		"""
		Validate that progress percentage is within valid range (0-100).
		"""
		if self.current_progress_percent < 0 or self.current_progress_percent > 100:
			frappe.throw("Current Progress Percent must be between 0 and 100")
	
	def validate_completion(self):
		"""
		Validate completion requirements.
		- If unit_status is Completed, completion_date should be set
		- If unit_status is Completed, current_progress_percent should be 100
		"""
		if self.unit_status == "Completed":
			if not self.completion_date:
				frappe.throw("Completion Date is required when Unit Status is Completed")
			
			if self.current_progress_percent != 100:
				# Auto-set to 100 if completed
				self.current_progress_percent = 100
		
		if self.unit_status == "In Progress":
			if not self.start_datetime:
				# Auto-set start_datetime when moving to In Progress
				self.start_datetime = frappe.utils.now_datetime()
	
	def before_save(self):
		"""
		Actions to perform before saving the document.
		"""
		# Auto-populate unit_name based on unit_code if not set
		if self.unit_code and not self.unit_name:
			self.unit_name = self.unit_code
