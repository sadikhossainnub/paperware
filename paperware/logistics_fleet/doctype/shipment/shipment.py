import frappe
from frappe.model.document import Document
from frappe import _

class Shipment(Document):
	def validate(self):
		if self.shipment_status in ["In Transit", "Delivered"]:
			if not self.delivery_note:
				frappe.throw(_("Delivery Note is required for shipments in transit or delivered"))
			if not self.trip:
				frappe.throw(_("Trip is required for shipments in transit or delivered"))
