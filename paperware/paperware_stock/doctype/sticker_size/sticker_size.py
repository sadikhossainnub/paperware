# Copyright (c) 2025, Frappe Technologies Pvt. Ltd. and contributors
# For license information, please see license.txt

# import frappe
from frappe.model.document import Document


class StickerSize(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		length: DF.Data | None
		shape: DF.Literal["", "Round", "Square"]
		weight: DF.Data | None
	# end: auto-generated types
	def autoname(self):
		self.name = f"{self.shape}-L{self.length}XW{self.weight}"
