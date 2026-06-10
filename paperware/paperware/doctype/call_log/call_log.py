# Copyright (c) 2026, abu sayed and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document

class CallLog(Document):
	def validate(self):
		self.auto_fetch_from_phone()
		self.auto_fetch_contact_from_customer()
		self.validate_participant()
	
	def auto_fetch_from_phone(self):
		"""Auto-fetch Customer, Lead, or Contact based on phone number"""
		if not self.phone_number:
			return
		
		# Clean phone number for comparison (remove spaces, dashes, etc.)
		clean_phone = self.phone_number.replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
		
		# Try to find Customer by phone
		if not self.customer:
			customer = frappe.db.sql("""
				SELECT dl.link_name
				FROM `tabDynamic Link` dl
				JOIN `tabContact Phone` cp ON dl.parent = cp.parent
				WHERE dl.link_doctype = 'Customer'
				AND (cp.phone LIKE %s OR cp.phone LIKE %s)
				LIMIT 1
			""", (f"%{clean_phone}%", f"%{self.phone_number}%"), as_dict=True)
			
			if customer:
				self.customer = customer[0].link_name
		
		# Try to find Lead by phone
		if not self.lead:
			lead = frappe.db.get_value("Lead", 
				{"phone": ["like", f"%{clean_phone}%"]}, 
				"name"
			)
			if not lead:
				lead = frappe.db.get_value("Lead", 
					{"mobile_no": ["like", f"%{clean_phone}%"]}, 
					"name"
				)
			if lead:
				self.lead = lead
		
		# Try to find Contact by phone
		if not self.contact:
			contact = frappe.db.sql("""
				SELECT parent 
				FROM `tabContact Phone`
				WHERE phone LIKE %s OR phone LIKE %s
				LIMIT 1
			""", (f"%{clean_phone}%", f"%{self.phone_number}%"), as_dict=True)
			
			if contact:
				self.contact = contact[0].parent
	
	def auto_fetch_contact_from_customer(self):
		"""Auto-fetch Contact Person when Customer is selected"""
		if not self.customer or self.contact:
			return
		
		# Find primary contact for this customer
		contact = frappe.db.sql("""
			SELECT parent
			FROM `tabDynamic Link`
			WHERE link_doctype = 'Customer'
			AND link_name = %s
			AND parenttype = 'Contact'
			ORDER BY is_primary_contact DESC
			LIMIT 1
		""", (self.customer,), as_dict=True)
		
		if contact:
			self.contact = contact[0].parent
	
	def validate_participant(self):
		"""Ensure either Customer or Lead is linked if possible, or phone number is present"""
		if not self.customer and not self.lead and not self.phone_number:
			frappe.throw("Please provide either Customer, Lead, or Phone Number")

