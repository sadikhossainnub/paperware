# Copyright (c) 2025, Frappe Technologies Pvt. Ltd. and contributors
# For license information, please see license.txt

# import frappe
from frappe.model.document import Document


class InvoiceSize(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		invoice_size_add_date: DF.Datetime
		length: DF.Data | None
		name: DF.Data | None
		width: DF.Data | None
	# end: auto-generated types
	def autoname(self):
		self.name = f"L{self.length or 0}XW{self.width or 0}"
