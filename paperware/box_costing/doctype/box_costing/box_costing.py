# Copyright (c) 2026, Sayed and contributors
# For license information, please see license.txt

import math
import frappe
from frappe import _
from frappe.model.document import Document


class BoxCosting(Document):

    # ─── Validation ───────────────────────────────────────────────────────────

    def validate(self):
        self._validate_inputs()
        self._validate_item_code()
        self._calculate()

    def _validate_inputs(self):
        if not self.item_code:
            frappe.throw(
                _("Item Code আবশ্যক। / Item Code is required.")
            )

        if not self.qty or self.qty <= 0:
            frappe.throw(
                _("অর্ডার পরিমাণ অবশ্যই ০-এর বেশি হতে হবে। / Order Qty must be greater than 0.")
            )

        if self.items and self.pcs_per_sheet is not None and self.pcs_per_sheet <= 0:
            frappe.throw(
                _("প্রতি শিটে পিস সংখ্যা ০-এর বেশি হতে হবে। / Pcs per Sheet must be greater than 0.")
            )

    def _validate_item_code(self):
        """Ensure item_code exists and is not disabled in the Item master."""
        if not self.item_code:
            return

        disabled = frappe.db.get_value("Item", self.item_code, "disabled")
        if disabled is None:
            frappe.throw(
                _("আইটেম '{0}' Item master-এ পাওয়া যায়নি। / Item '{0}' not found in Item master.").format(
                    self.item_code
                )
            )
        if disabled:
            frappe.throw(
                _("আইটেম '{0}' নিষ্ক্রিয় করা আছে। / Item '{0}' is disabled.").format(
                    self.item_code
                )
            )

        # Sync item_name in case fetch_from hasn't fired server-side
        self.item_name = frappe.db.get_value("Item", self.item_code, "item_name")

        # Sync UOM from item if not set
        if not self.uom:
            self.uom = frappe.db.get_value("Item", self.item_code, "stock_uom") or "Nos"

    # ─── Calculations ─────────────────────────────────────────────────────────

    def _calculate(self):
        self._calculate_item_amounts()
        self._calculate_totals()

    def _calculate_item_amounts(self):
        """Calculate amount for each cost item row."""
        for item in self.get("items") or []:
            rate = float(item.rate or 0)
            multiplier = float(item.multiplier or 1)
            item.amount = round(rate * multiplier, 2)

    def _calculate_totals(self):
        """Derive all summary figures from item rows and header fields."""
        qty = int(self.qty or 0)

        # Total amount = sum of all item amounts
        self.total_amount = round(
            sum(float(item.amount or 0) for item in (self.get("items") or [])), 2
        )

        # Total sheets = ceil(qty / pcs_per_sheet)
        pcs_per_sheet = int(self.pcs_per_sheet or 0)
        if pcs_per_sheet > 0:
            self.total_sheets = math.ceil(qty / pcs_per_sheet)
        else:
            self.total_sheets = 0

        # Production rate per piece
        if qty > 0:
            self.production_rate = round(self.total_amount / qty, 2)
        else:
            self.production_rate = 0

        # Margin
        margin_pct = float(self.margin_percent or 0)
        self.margin_amount = round(self.production_rate * (margin_pct / 100), 2)

        # Final rate
        self.final_rate = round(self.production_rate + self.margin_amount, 2)

    # ─── Quotation helper (whitelisted) ───────────────────────────────────────

    @frappe.whitelist()
    def make_quotation(self):
        """Create a Quotation from this Box Costing record."""
        q = frappe.new_doc("Quotation")
        q.quotation_to = "Customer"
        if self.client_name:
            q.party_name = self.client_name
        q.transaction_date = self.costing_date or frappe.utils.today()
        q.company = frappe.defaults.get_user_default("Company")

        uom = self.uom or frappe.db.get_value("Item", self.item_code, "stock_uom") or "Nos"
        q.append("items", {
            "item_code": self.item_code,
            "item_name": self.item_name,
            "qty": self.qty or 1,
            "uom": uom,
            "rate": self.final_rate or 0,
        })

        q.flags.ignore_permissions = True
        q.insert()
        return q.name
