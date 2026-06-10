import frappe
from frappe.model.document import Document

class BoxSize(Document):
    # begin: auto-generated types
    # This code is auto-generated. Do not modify anything in this block.

    from typing import TYPE_CHECKING

    if TYPE_CHECKING:
        from frappe.types import DF

        height: DF.Data | None
        length: DF.Data | None
        name: DF.Data | None
        weight: DF.Data | None
    # end: auto-generated types
    def autoname(self):
        # Get and sanitize field values
        h = str(self.height).strip() if self.height else "0"
        w = str(self.weight).strip() if self.weight else "0"
        l = str(self.length).strip() if self.length else "0"

        # Set the document name
        self.name = f"H{h}XW{w}XL{l}"
