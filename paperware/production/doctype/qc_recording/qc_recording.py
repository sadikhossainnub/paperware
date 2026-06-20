# -*- coding: utf-8 -*-
# Copyright (c) 2024, Paperware and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe.model.document import Document


class QCRecording(Document):
	"""
	QC Recording DocType
	
	Records quality control results and wastage for Production Order Items.
	Tracks defects, wastage metrics, and triggers RCA when wastage exceeds thresholds.
	
	Key responsibilities:
	- Record QC inspection results (Passed/Failed/Rework)
	- Track defect counts and descriptions
	- Calculate wastage percentages
	- Flag items requiring Root Cause Analysis (RCA)
	- Support Production Order Item status updates
	
	Validates: Requirements 14.1, 14.2
	"""
	
	def validate(self):
		"""
		Validate the QC Recording document before saving.
		
		Validates:
		- Required fields are present
		- Production Order Item reference exists
		- Numeric constraints (defect_count >= 0, wastage_qty >= 0)
		- QC result is valid
		"""
		self.validate_required_fields()
		self.validate_production_order_item()
		self.validate_numeric_constraints()
		self.calculate_wastage_percentage()
		self.check_rca_requirement()
	
	def validate_required_fields(self):
		"""
		Validate required fields are present.
		
		Required fields:
		- production_order_item
		- qc_result
		- qc_inspector_name
		- qc_datetime
		"""
		if not self.production_order_item:
			frappe.throw("Production Order Item is required")
		
		if not self.qc_result:
			frappe.throw("QC Result is required")
		
		if not self.qc_inspector_name:
			frappe.throw("QC Inspector Name is required")
		
		if not self.qc_datetime:
			frappe.throw("QC Date & Time is required")
	
	def validate_production_order_item(self):
		"""
		Validate that the Production Order Item reference exists.
		"""
		if not frappe.db.exists("Production Order Item", self.production_order_item):
			frappe.throw(
				"Production Order Item '{0}' does not exist".format(
					self.production_order_item
				)
			)
	
	def validate_numeric_constraints(self):
		"""
		Validate numeric field constraints.
		
		Constraints:
		- defect_count >= 0
		- wastage_qty >= 0
		- acceptable_threshold >= 0
		"""
		if self.defect_count and self.defect_count < 0:
			frappe.throw("Defect Count cannot be negative")
		
		if self.wastage_qty and self.wastage_qty < 0:
			frappe.throw("Wastage Quantity cannot be negative")
		
		if self.acceptable_threshold and self.acceptable_threshold < 0:
			frappe.throw("Acceptable Threshold cannot be negative")
	
	def calculate_wastage_percentage(self):
		"""
		Calculate wastage percentage based on wastage_qty and produced_qty.
		
		Formula: wastage_percentage = wastage_qty / (produced_qty + wastage_qty)
		
		Validates: Requirement 14.2
		"""
		if not self.wastage_qty or self.wastage_qty == 0:
			self.wastage_percentage = 0.0
			return
		
		# Fetch produced_qty from Production Order Item
		try:
			item_doc = frappe.get_doc("Production Order Item", self.production_order_item)
			produced_qty = item_doc.produced_qty or 0
			
			total_qty = produced_qty + self.wastage_qty
			
			if total_qty > 0:
				self.wastage_percentage = (self.wastage_qty / total_qty) * 100
			else:
				self.wastage_percentage = 0.0
		
		except Exception as e:
			frappe.log_error(
				"Error calculating wastage percentage: {0}".format(str(e)),
				"QC Recording Wastage Calculation"
			)
			self.wastage_percentage = 0.0
	
	def check_rca_requirement(self):
		"""
		Check if wastage percentage exceeds acceptable threshold.
		If yes, flag for Root Cause Analysis (RCA).
		
		Validates: Requirement 14.3
		"""
		if not self.acceptable_threshold:
			self.acceptable_threshold = 5.0  # Default to 5%
		
		if self.wastage_percentage and self.wastage_percentage > self.acceptable_threshold:
			self.rca_required = 1
		else:
			self.rca_required = 0
	
	def before_save(self):
		"""
		Hook called before saving the document.
		Ensures calculations are up-to-date.
		"""
		self.calculate_wastage_percentage()
		self.check_rca_requirement()
	
	def on_submit(self):
		"""
		Hook called when the document is submitted.
		Updates the Production Order Item status based on QC result.
		
		Validates: Requirement 14.4
		"""
		self.update_production_order_item_status()
	
	def update_production_order_item_status(self):
		"""
		Update Production Order Item status based on QC result.
		
		- Passed: Mark item as Completed
		- Failed: Mark item as Failed
		- Rework: Revert item to In Production
		
		Validates: Requirement 14.4
		"""
		try:
			item_doc = frappe.get_doc("Production Order Item", self.production_order_item)
			
			if self.qc_result == "Passed":
				item_doc.item_status = "Completed"
				frappe.msgprint(
					"Production Order Item '{0}' marked as Completed".format(
						self.production_order_item
					)
				)
			
			elif self.qc_result == "Failed":
				item_doc.item_status = "Failed"
				frappe.msgprint(
					"Production Order Item '{0}' marked as Failed".format(
						self.production_order_item
					)
				)
			
			elif self.qc_result == "Rework":
				item_doc.item_status = "In Progress"
				frappe.msgprint(
					"Production Order Item '{0}' reverted to In Progress for rework".format(
						self.production_order_item
					)
				)
			
			item_doc.save()
		
		except Exception as e:
			frappe.log_error(
				"Error updating Production Order Item status: {0}".format(str(e)),
				"QC Recording Status Update"
			)
			frappe.throw(
				"Failed to update Production Order Item status: {0}".format(str(e))
			)
	
	def on_cancel(self):
		"""
		Hook called when the document is cancelled.
		Can be used to revert Production Order Item status if needed.
		"""
		pass
	
	def get_qc_summary(self):
		"""
		Get a formatted summary of QC recording details.
		
		Returns:
			dict: QC recording summary
		"""
		return {
			"name": self.name,
			"production_order_item": self.production_order_item,
			"qc_result": self.qc_result,
			"qc_inspector_name": self.qc_inspector_name,
			"qc_datetime": self.qc_datetime,
			"defect_count": self.defect_count,
			"defect_description": self.defect_description,
			"wastage_qty": self.wastage_qty,
			"wastage_reason": self.wastage_reason,
			"wastage_percentage": self.wastage_percentage,
			"acceptable_threshold": self.acceptable_threshold,
			"rca_required": self.rca_required
		}


@frappe.whitelist()
def get_qc_recording(name):
	"""
	API method to retrieve QC recording by name.
	
	Args:
		name (str): QC Recording name
	
	Returns:
		dict: QC recording summary or None if not found
	"""
	try:
		doc = frappe.get_doc("QC Recording", name)
		return doc.get_qc_summary()
	except frappe.DoesNotExistError:
		return None


@frappe.whitelist()
def create_qc_recording(qc_data):
	"""
	API method to create a new QC recording.
	
	Args:
		qc_data (dict): QC recording data
	
	Returns:
		dict: Created QC recording summary
	"""
	import json
	
	if isinstance(qc_data, str):
		qc_data = json.loads(qc_data)
	
	doc = frappe.new_doc("QC Recording")
	doc.update(qc_data)
	doc.insert()
	
	return doc.get_qc_summary()


@frappe.whitelist()
def get_qc_recordings_by_item(production_order_item):
	"""
	API method to retrieve all QC recordings for a Production Order Item.
	
	Args:
		production_order_item (str): Production Order Item name
	
	Returns:
		list: List of QC recording summaries
	"""
	recordings = frappe.get_all(
		"QC Recording",
		filters={"production_order_item": production_order_item},
		fields=["name", "qc_result", "qc_inspector_name", "qc_datetime", 
		        "wastage_qty", "wastage_percentage", "rca_required"],
		order_by="qc_datetime desc"
	)
	
	return recordings
