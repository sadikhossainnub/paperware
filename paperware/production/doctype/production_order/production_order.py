# Copyright (c) 2024, abu sayed and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class ProductionOrder(Document):
	"""
	Production Order DocType for managing manufacturing execution from Sales Order approval
	to inventory completion. Handles production specifications, resource allocation,
	material tracking, and quality control with real-time progress monitoring.
	
	Lifecycle States: Draft → Planned → Material_Requested → Material_Issued → 
	                  In_Production → QC_Pending → Completed → Closed
	"""
	
	def validate(self):
		"""
		Validate Production Order before saving.
		Ensures data integrity and business rule compliance.
		"""
		self.validate_dates()
		self.validate_status_transition()
	
	def validate_dates(self):
		"""
		Validate that delivery_date and planned_date are logical.
		"""
		if self.planned_date and self.delivery_date:
			if self.planned_date > self.delivery_date:
				frappe.throw("Planned Date cannot be after Delivery Date")
	
	def validate_status_transition(self):
		"""
		Validate that status transitions follow the defined lifecycle.
		Each transition may have specific validation requirements.
		"""
		# Get the previous status if this is an update
		if not self.is_new():
			old_doc = self.get_doc_before_save()
			if old_doc and old_doc.production_status != self.production_status:
				self.validate_status_change(old_doc.production_status, self.production_status)
	
	def validate_status_change(self, old_status, new_status):
		"""
		Validate specific status transitions.
		
		Args:
			old_status: Previous production status
			new_status: New production status to validate
		"""
		# Define valid transitions
		valid_transitions = {
			"Draft": ["Planned"],
			"Planned": ["Material_Requested"],
			"Material_Requested": ["Material_Issued"],
			"Material_Issued": ["In_Production"],
			"In_Production": ["QC_Pending"],
			"QC_Pending": ["Completed"],
			"Completed": ["Closed"]
		}
		
		# Check if transition is valid
		if old_status in valid_transitions:
			if new_status not in valid_transitions[old_status]:
				frappe.throw(
					f"Invalid status transition from {old_status} to {new_status}. "
					f"Valid next states: {', '.join(valid_transitions[old_status])}"
				)
		
		# Perform transition-specific validations
		if new_status == "Planned":
			self.validate_planned_transition()
		elif new_status == "Material_Requested":
			self.validate_material_requested_transition()
		elif new_status == "Material_Issued":
			self.validate_material_issued_transition()
		elif new_status == "In_Production":
			self.validate_in_production_transition()
		elif new_status == "QC_Pending":
			self.validate_qc_pending_transition()
		elif new_status == "Completed":
			self.validate_completed_transition()
	
	def validate_planned_transition(self):
		"""
		Validate transition to Planned status.
		Requirements: all items have qty_to_produce > 0, all items have specifications
		"""
		if not self.items or len(self.items) == 0:
			frappe.throw("Cannot transition to Planned: Production Order must have at least one item")
	
	def validate_material_requested_transition(self):
		"""
		Validate transition to Material_Requested status.
		Requirements: Material Requests exist for all items
		"""
		pass  # Will be implemented when Material Request integration is added
	
	def validate_material_issued_transition(self):
		"""
		Validate transition to Material_Issued status.
		Requirements: all materials are issued to warehouse location
		"""
		pass  # Will be implemented when Material Request integration is added
	
	def validate_in_production_transition(self):
		"""
		Validate transition to In_Production status.
		Requirements: all Production Units assigned, Materials at production location
		"""
		pass  # Will be implemented when Production Unit Assignment is added
	
	def validate_qc_pending_transition(self):
		"""
		Validate transition to QC_Pending status.
		Requirements: all items have completed their assigned production units
		"""
		pass  # Will be implemented when Production Unit Assignment is added
	
	def validate_completed_transition(self):
		"""
		Validate transition to Completed status.
		Requirements: all QC passes or rework approved
		"""
		pass  # Will be implemented when QC Recording is added
	
	def on_submit(self):
		"""
		Actions to perform when Production Order is submitted.
		"""
		pass
	
	def on_cancel(self):
		"""
		Actions to perform when Production Order is cancelled.
		"""
		pass
	
	def on_update_after_submit(self):
		"""
		Actions to perform when Production Order is updated after submission.
		"""
		pass
