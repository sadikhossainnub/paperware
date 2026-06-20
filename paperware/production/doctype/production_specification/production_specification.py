# -*- coding: utf-8 -*-
# Copyright (c) 2024, Paperware and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe.model.document import Document


class ProductionSpecification(Document):
	"""
	Production Specification DocType
	
	Stores manufacturing specifications for production items.
	Supports two specification types:
	- Printing: for printing-related production items
	- Paper Cup: for paper cup manufacturing items
	
	Each type has its own set of required fields.
	"""
	
	def validate(self):
		"""
		Validate the Production Specification document before saving.
		
		Validates:
		- Required fields based on specification_type
		- Field constraints and data integrity
		"""
		self.validate_required_fields()
		self.validate_field_constraints()
	
	def validate_required_fields(self):
		"""
		Validate required fields based on specification_type.
		
		For Printing type:
		- size, gsm, color, printing_type, lamination, pe_coating, finish_type, artwork_version
		
		For Paper Cup type:
		- cup_size, wall_type, paper_gsm, pe_type, print_color
		"""
		if not self.specification_type:
			frappe.throw("Specification Type is required")
		
		if not self.item_code:
			frappe.throw("Item Code is required")
		
		if self.specification_type == "Printing":
			self._validate_printing_fields()
		elif self.specification_type == "Paper Cup":
			self._validate_paper_cup_fields()
	
	def _validate_printing_fields(self):
		"""
		Validate required fields for Printing specification type.
		"""
		required_fields = {
			"size": "Size",
			"gsm": "GSM",
			"color": "Color",
			"printing_type": "Printing Type",
			"lamination": "Lamination",
			"pe_coating": "PE Coating",
			"finish_type": "Finish Type",
			"artwork_version": "Artwork Version"
		}
		
		missing_fields = []
		for field, label in required_fields.items():
			if not self.get(field):
				missing_fields.append(label)
		
		if missing_fields:
			frappe.throw(
				"The following fields are required for Printing specifications: {0}".format(
					", ".join(missing_fields)
				)
			)
	
	def _validate_paper_cup_fields(self):
		"""
		Validate required fields for Paper Cup specification type.
		"""
		required_fields = {
			"cup_size": "Cup Size",
			"wall_type": "Wall Type",
			"paper_gsm": "Paper GSM",
			"pe_type": "PE Type",
			"print_color": "Print Color"
		}
		
		missing_fields = []
		for field, label in required_fields.items():
			if not self.get(field):
				missing_fields.append(label)
		
		if missing_fields:
			frappe.throw(
				"The following fields are required for Paper Cup specifications: {0}".format(
					", ".join(missing_fields)
				)
			)
	
	def validate_field_constraints(self):
		"""
		Validate field constraints and data integrity.
		
		Validates:
		- GSM values are positive
		- Paper GSM values are positive
		- Valid enum values for select fields
		"""
		# Validate GSM for printing specifications
		if self.specification_type == "Printing" and self.gsm:
			if self.gsm <= 0:
				frappe.throw("GSM must be a positive number")
		
		# Validate Paper GSM for paper cup specifications
		if self.specification_type == "Paper Cup" and self.paper_gsm:
			if self.paper_gsm <= 0:
				frappe.throw("Paper GSM must be a positive number")
		
		# Validate printing_type if provided
		if self.specification_type == "Printing" and self.printing_type:
			valid_printing_types = ["Offset", "Digital", "Flexo", "Screen"]
			if self.printing_type not in valid_printing_types:
				frappe.throw(
					"Invalid Printing Type. Must be one of: {0}".format(
						", ".join(valid_printing_types)
					)
				)
		
		# Validate lamination if provided
		if self.specification_type == "Printing" and self.lamination:
			if self.lamination not in ["Yes", "No"]:
				frappe.throw("Lamination must be either 'Yes' or 'No'")
		
		# Validate pe_coating if provided
		if self.specification_type == "Printing" and self.pe_coating:
			if self.pe_coating not in ["Yes", "No"]:
				frappe.throw("PE Coating must be either 'Yes' or 'No'")
		
		# Validate finish_type if provided
		if self.specification_type == "Printing" and self.finish_type:
			valid_finish_types = ["Glossy", "Matte", "Texture"]
			if self.finish_type not in valid_finish_types:
				frappe.throw(
					"Invalid Finish Type. Must be one of: {0}".format(
						", ".join(valid_finish_types)
					)
				)
		
		# Validate wall_type for paper cup
		if self.specification_type == "Paper Cup" and self.wall_type:
			valid_wall_types = ["Single", "Double", "Triple"]
			if self.wall_type not in valid_wall_types:
				frappe.throw(
					"Invalid Wall Type. Must be one of: {0}".format(
						", ".join(valid_wall_types)
					)
				)
		
		# Validate print_color for paper cup
		if self.specification_type == "Paper Cup" and self.print_color:
			if self.print_color not in ["Single", "Multi"]:
				frappe.throw("Print Color must be either 'Single' or 'Multi'")
	
	def before_save(self):
		"""
		Hook called before saving the document.
		Can be used for additional processing or data cleanup.
		"""
		# Clear fields that don't belong to the current specification type
		if self.specification_type == "Printing":
			self._clear_paper_cup_fields()
		elif self.specification_type == "Paper Cup":
			self._clear_printing_fields()
	
	def _clear_paper_cup_fields(self):
		"""
		Clear paper cup fields when specification_type is Printing.
		"""
		self.cup_size = None
		self.wall_type = None
		self.paper_gsm = None
		self.pe_type = None
		self.print_color = None
	
	def _clear_printing_fields(self):
		"""
		Clear printing fields when specification_type is Paper Cup.
		"""
		self.size = None
		self.gsm = None
		self.color = None
		self.printing_type = None
		self.lamination = None
		self.pe_coating = None
		self.finish_type = None
		self.artwork_version = None
	
	def on_update(self):
		"""
		Hook called after the document is saved/updated.
		Can be used for logging or triggering related updates.
		"""
		pass
	
	def get_specification_details(self):
		"""
		Get a formatted dictionary of all specification details.
		
		Returns:
			dict: Specification details based on type
		"""
		if self.specification_type == "Printing":
			return {
				"specification_type": self.specification_type,
				"item_code": self.item_code,
				"size": self.size,
				"gsm": self.gsm,
				"color": self.color,
				"printing_type": self.printing_type,
				"lamination": self.lamination,
				"pe_coating": self.pe_coating,
				"finish_type": self.finish_type,
				"artwork_version": self.artwork_version
			}
		elif self.specification_type == "Paper Cup":
			return {
				"specification_type": self.specification_type,
				"item_code": self.item_code,
				"cup_size": self.cup_size,
				"wall_type": self.wall_type,
				"paper_gsm": self.paper_gsm,
				"pe_type": self.pe_type,
				"print_color": self.print_color
			}
		else:
			return {
				"specification_type": self.specification_type,
				"item_code": self.item_code
			}


@frappe.whitelist()
def get_production_specification(item_code):
	"""
	API method to retrieve production specification by item code.
	
	Args:
		item_code (str): Item code to lookup
	
	Returns:
		dict: Production specification details or None if not found
	"""
	try:
		doc = frappe.get_doc("Production Specification", item_code)
		return doc.get_specification_details()
	except frappe.DoesNotExistError:
		return None


@frappe.whitelist()
def create_production_specification(specification_data):
	"""
	API method to create a new production specification.
	
	Args:
		specification_data (dict): Specification data including type and fields
	
	Returns:
		dict: Created specification details
	"""
	import json
	
	if isinstance(specification_data, str):
		specification_data = json.loads(specification_data)
	
	doc = frappe.new_doc("Production Specification")
	doc.update(specification_data)
	doc.insert()
	
	return doc.get_specification_details()
