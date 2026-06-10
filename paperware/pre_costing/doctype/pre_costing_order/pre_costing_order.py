# Copyright (c) 2026, Sayed and contributors
# For license information, please see license.txt

import math
import frappe
from frappe import _
from frappe.model.document import Document


class PreCostingOrder(Document):

    def on_load(self):
        """Load defaults from PC Item Type Config"""
        if self.item_type:
            try:
                config = frappe.db.get_value(
                    "PC Item Type Config",
                    self.item_type,
                    [
                        "default_profit_markup",
                        "default_chaat_percent",
                        "default_gripper_margin",
                        "default_flap_height",
                        "default_glue_tab",
                        "default_pasting_gap",
                    ],
                    as_dict=1
                )
                if config:
                    if not self.profit_markup and config.default_profit_markup:
                        self.profit_markup = config.default_profit_markup
                    if not self.chaat_percent and config.default_chaat_percent:
                        self.chaat_percent = config.default_chaat_percent
                    if not self.gripper_margin_mm and config.default_gripper_margin:
                        self.gripper_margin_mm = config.default_gripper_margin
                    if not self.flap_height_mm and config.default_flap_height:
                        self.flap_height_mm = config.default_flap_height
                    if not self.glue_tab_mm and config.default_glue_tab:
                        self.glue_tab_mm = config.default_glue_tab
                    if not self.pasting_gap_mm and config.default_pasting_gap:
                        self.pasting_gap_mm = config.default_pasting_gap
            except Exception as e:
                frappe.log_error(f"Error loading PC Item Type Config: {str(e)}", "Pre Costing Order")

    def validate(self):
        """Comprehensive validation"""
        # Item name auto-fetch
        if self.fg_item:
            self.item_name = frappe.db.get_value("Item", self.fg_item, "item_name")

        # mm → inch conversion (sheet dimensions)
        if self.sheet_width_mm:
            self.sheet_width_in = round(self.sheet_width_mm / 25.4, 4)
        if self.sheet_height_mm:
            self.sheet_height_in = round(self.sheet_height_mm / 25.4, 4)

        # Validate required fields
        if not self.customer:
            frappe.throw("Customer is required")
        if not self.item_type:
            frappe.throw("Item Type is required")
        if not self.fg_item:
            frappe.throw("Finished Goods Item is required")
        if not self.target_qty or self.target_qty <= 0:
            frappe.throw("Target Quantity must be > 0")

        # Validate sheet dimensions
        if not self.sheet_width_mm or self.sheet_width_mm <= 0:
            frappe.throw("Sheet Width must be > 0")
        if not self.sheet_height_mm or self.sheet_height_mm <= 0:
            frappe.throw("Sheet Height must be > 0")

        # Validate item type-specific dimensions
        self._validate_item_type_dimensions()

    def _validate_item_type_dimensions(self):
        """Validate dimensions based on item type"""
        item_type = self.item_type

        if item_type in ["Paper Cup", "Cup Holder", "Cup Jacket", "French Fry Cone"]:
            if not self.cup_top_diameter_mm or self.cup_top_diameter_mm <= 0:
                frappe.throw("Cup Top Diameter must be > 0")
            if not self.cup_bottom_diameter_mm or self.cup_bottom_diameter_mm <= 0:
                frappe.throw("Cup Bottom Diameter must be > 0")
            if not self.cup_height_mm or self.cup_height_mm <= 0:
                frappe.throw("Cup Height must be > 0")
            if self.cup_top_diameter_mm < self.cup_bottom_diameter_mm:
                frappe.msgprint("Warning: Top diameter is smaller than bottom diameter", alert=True)

        elif item_type in ["Meal Box", "Outer Box", "Tissue Box"]:
            if not self.box_length_mm or self.box_length_mm <= 0:
                frappe.throw("Box Length must be > 0")
            if not self.box_width_mm or self.box_width_mm <= 0:
                frappe.throw("Box Width must be > 0")
            if not self.box_height_mm or self.box_height_mm <= 0:
                frappe.throw("Box Height must be > 0")

        elif item_type == "Paper Bag":
            if not self.bag_width_mm or self.bag_width_mm <= 0:
                frappe.throw("Bag Width must be > 0")
            if not self.bag_height_mm or self.bag_height_mm <= 0:
                frappe.throw("Bag Height must be > 0")

        elif item_type in ["Table Paper Matt", "Paper Leaflet", "Paper Sticker", "Business Card", "Hand Tag", "Memo Book", "Enevolve"]:
            if not self.item_width_mm or self.item_width_mm <= 0:
                frappe.throw("Item Width must be > 0")
            if not self.item_height_mm or self.item_height_mm <= 0:
                frappe.throw("Item Height must be > 0")

        elif item_type == "Plastic Lid":
            if not self.lid_top_diameter_mm or self.lid_top_diameter_mm <= 0:
                frappe.throw("Lid Top Diameter must be > 0")

    def before_save(self):
        """Main calculation pipeline"""
        self._run_geometry()
        self._calculate_sheets_required()
        self._calculate_paper_cost()
        self._calculate_printing_cost()
        self._calculate_lamination_cost()
        self._calculate_die_cutting_cost()
        self._calculate_foaming_cost()
        self._calculate_additional_charges()
        self._calculate_final_costs()
        self._calculate_multi_qty()

    # ─── Step 1: Geometry ───
    def _run_geometry(self):
        """Item type অনুযায়ী geometry engine চালাও"""
        item_type = self.item_type
        if not item_type:
            return

        CUP_TYPES = ["Paper Cup", "Cup Holder", "Cup Jacket", "French Fry Cone"]
        BOX_TYPES = ["Meal Box", "Outer Box", "Tissue Box"]
        BAG_TYPES = ["Paper Bag"]
        SHEET_TYPES = ["Table Paper Matt", "Paper Leaflet", "Paper Sticker",
                       "Business Card", "Hand Tag", "Memo Book", "Enevolve"]
        LID_TYPES = ["Plastic Lid"]

        if item_type in CUP_TYPES:
            self._geometry_cup_cone()
        elif item_type in BOX_TYPES:
            self._geometry_flat_box()
        elif item_type in BAG_TYPES:
            self._geometry_paper_bag()
        elif item_type in SHEET_TYPES:
            self._geometry_flat_sheet()
        elif item_type in LID_TYPES:
            self._geometry_lid()

    def _geometry_cup_cone(self):
        """Fan-shape geometry for Cup/Cone items"""
        top_d = self.cup_top_diameter_mm or 0
        bot_d = self.cup_bottom_diameter_mm or 0
        h = self.cup_height_mm or 0
        pgap = self.pasting_gap_mm or 3.0
        sw = self.sheet_width_mm or 0
        sh = self.sheet_height_mm or 0

        if not (top_d and bot_d and h and sw and sh):
            return

        r1, r2 = top_d / 2.0, bot_d / 2.0
        slant_h = math.sqrt(h ** 2 + (r1 - r2) ** 2)
        is_cylinder = abs(r1 - r2) < 0.001

        if is_cylinder:
            fan_w = math.pi * top_d + pgap
            fan_h = h
            fan_area = fan_w * fan_h
            bot_w = fan_w
        else:
            r_small = (r2 * slant_h) / (r1 - r2)
            r_large = r_small + slant_h
            theta = ((math.pi * top_d) + pgap) / r_large
            fan_w = 2 * r_large * math.sin(theta / 2.0)
            fan_h = r_large - r_small * math.cos(theta / 2.0)
            fan_area = (0.5 * r_large ** 2 * theta) - (0.5 * r_small ** 2 * theta)
            bot_w = 2 * r_small * math.sin(theta / 2.0)

        # Nesting
        nesting_gap = 2.0
        step_x = (fan_w + nesting_gap) if is_cylinder else ((fan_w + bot_w) / 2.0 + nesting_gap)
        step_y = slant_h

        gripper = self.gripper_margin_mm or 12.0
        usable_w = sw - gripper
        usable_h = sh

        cols = math.floor((usable_w - fan_w) / step_x) + 1 if usable_w >= fan_w else 0
        rows = math.floor((usable_h - fan_h) / step_y) + 1 if usable_h >= fan_h else 0
        ups = int(cols * rows)

        self.blank_width_mm = round(fan_w, 2)
        self.blank_height_mm = round(fan_h, 2)
        self.blank_area_sq_mm = round(fan_area, 2)
        self.ups_per_sheet = ups

        total_area = sw * sh
        used_area = ups * fan_area
        self.waste_percent = round(
            max(0, (total_area - used_area) / total_area * 100) if total_area > 0 else 0, 1
        )

    def _geometry_flat_box(self):
        """Box blank unfolding for Meal Box, Outer Box, Tissue Box"""
        L = self.box_length_mm or 0
        W = self.box_width_mm or 0
        H = self.box_height_mm or 0
        flap = self.flap_height_mm or (W / 2.0)
        glue = self.glue_tab_mm or 15.0
        sw = self.sheet_width_mm or 0
        sh = self.sheet_height_mm or 0
        gripper = self.gripper_margin_mm or 12.0

        if not (L and W and H and sw and sh):
            return

        # Cross-shaped blank
        blank_w = 2 * L + 2 * W + glue
        blank_h = 2 * flap + 2 * H + W

        # Sheet imposition
        usable_w = sw - gripper
        cols = math.floor(usable_w / blank_w) if blank_w > 0 else 0
        rows = math.floor(sh / blank_h) if blank_h > 0 else 0
        ups = int(cols * rows)

        self.blank_width_mm = round(blank_w, 2)
        self.blank_height_mm = round(blank_h, 2)
        self.blank_area_sq_mm = round(blank_w * blank_h, 2)
        self.ups_per_sheet = ups

        total_area = sw * sh
        used_area = ups * blank_w * blank_h
        self.waste_percent = round(
            max(0, (total_area - used_area) / total_area * 100) if total_area > 0 else 0, 1
        )

    def _geometry_paper_bag(self):
        """Paper Bag blank calculation with gusset"""
        bw = self.bag_width_mm or 0
        bh = self.bag_height_mm or 0
        gusset = self.bag_gusset_mm or 0
        bottom = self.bag_bottom_mm or 0
        seam = 10.0
        sw = self.sheet_width_mm or 0
        sh = self.sheet_height_mm or 0
        gripper = self.gripper_margin_mm or 12.0

        if not (bw and bh and sw and sh):
            return

        blank_w = bw + 2 * gusset + 2 * seam
        blank_h = bh + bottom + 20

        usable_w = sw - gripper
        cols = math.floor(usable_w / blank_w) if blank_w > 0 else 0
        rows = math.floor(sh / blank_h) if blank_h > 0 else 0
        ups = int(cols * rows)

        self.blank_width_mm = round(blank_w, 2)
        self.blank_height_mm = round(blank_h, 2)
        self.blank_area_sq_mm = round(blank_w * blank_h, 2)
        self.ups_per_sheet = ups

        total_area = sw * sh
        used_area = ups * blank_w * blank_h
        self.waste_percent = round(
            max(0, (total_area - used_area) / total_area * 100) if total_area > 0 else 0, 1
        )

    def _geometry_flat_sheet(self):
        """Standard flat imposition for Business Card, Leaflet, Sticker, etc."""
        iw = self.item_width_mm or 0
        ih = self.item_height_mm or 0
        bleed = self.bleed_mm or 3.0
        sw = self.sheet_width_mm or 0
        sh = self.sheet_height_mm or 0
        gripper = self.gripper_margin_mm or 12.0

        if not (iw and ih and sw and sh):
            return

        design_w = iw + 2 * bleed
        design_h = ih + 2 * bleed

        usable_w = sw - gripper
        cols = math.floor(usable_w / design_w) if design_w > 0 else 0
        rows = math.floor(sh / design_h) if design_h > 0 else 0

        # Try rotated orientation
        cols_r = math.floor(usable_w / design_h) if design_h > 0 else 0
        rows_r = math.floor(sh / design_w) if design_w > 0 else 0
        ups = max(int(cols * rows), int(cols_r * rows_r))

        self.blank_width_mm = round(design_w, 2)
        self.blank_height_mm = round(design_h, 2)
        self.blank_area_sq_mm = round(design_w * design_h, 2)
        self.ups_per_sheet = ups

        total_area = sw * sh
        used_area = ups * design_w * design_h
        self.waste_percent = round(
            max(0, (total_area - used_area) / total_area * 100) if total_area > 0 else 0, 1
        )

    def _geometry_lid(self):
        """Plastic Lid - circular blank with hexagonal packing"""
        top_d = self.lid_top_diameter_mm or 0
        rim_h = self.lid_height_mm or 0
        flange = self.lid_flange_mm or 0
        gap = 2.0
        sw = self.sheet_width_mm or 0
        sh = self.sheet_height_mm or 0

        if not (top_d and sw and sh):
            return

        blank_d = top_d + 2 * rim_h + 2 * flange
        step_x = blank_d + gap
        step_y = (blank_d + gap) * math.sin(math.radians(60))

        cols_even = math.floor(sw / step_x)
        cols_odd = math.floor((sw - blank_d / 2) / step_x) if sw > blank_d / 2 else 0
        total_rows = math.floor((sh - blank_d) / step_y) + 1 if sh >= blank_d else 0

        even_rows = math.ceil(total_rows / 2)
        odd_rows = math.floor(total_rows / 2)
        ups = int(even_rows * cols_even + odd_rows * cols_odd)

        blank_area = math.pi * (blank_d / 2) ** 2
        self.blank_width_mm = round(blank_d, 2)
        self.blank_height_mm = round(blank_d, 2)
        self.blank_area_sq_mm = round(blank_area, 2)
        self.ups_per_sheet = ups

        total_area = sw * sh
        used_area = ups * blank_area
        self.waste_percent = round(
            max(0, (total_area - used_area) / total_area * 100) if total_area > 0 else 0, 1
        )

    # ─── Step 2: Sheets Required ───
    def _calculate_sheets_required(self):
        if self.target_qty and self.ups_per_sheet and self.ups_per_sheet > 0:
            waste_factor = 1 + (float(self.chaat_percent or 0) / 100.0)
            self.sheets_required = math.ceil(
                (self.target_qty / self.ups_per_sheet) * waste_factor
            )
        else:
            self.sheets_required = 0

    # ─── Step 3: Paper Cost ───
    def _calculate_paper_cost(self):
        if not self.paper_rate_per_sheet:
            if self.paper_item:
                self.paper_rate_per_sheet = _get_item_rate(self.paper_item)

        chaat_val = float(self.paper_rate_per_sheet or 0) * (float(self.chaat_percent or 0) / 100.0)
        self.net_paper_rate = max(0, float(self.paper_rate_per_sheet or 0) - chaat_val)
        self.total_paper_cost = self.net_paper_rate * float(self.sheets_required or 0)

    # ─── Step 4: Printing Cost ───
    def _calculate_printing_cost(self):
        """Calculate printing cost with error handling"""
        try:
            if not self.printing_required or not self.printing_machine or not self.print_colors:
                self.total_printing_cost = 0
                return

            # Parse color count
            try:
                color_count = int(self.print_colors.split(" ")[0].replace("+", ""))
            except (ValueError, IndexError):
                frappe.msgprint(
                    f"Warning: Could not parse print colors '{self.print_colors}'. Using 1 color.",
                    alert=True
                )
                color_count = 1

            impressions = (self.sheets_required or 0) * color_count

            # Fetch rate cards
            rate_cards = frappe.db.get_list(
                "Printing Rate Card",
                filters={
                    "machine": self.printing_machine,
                    "colors": self.print_colors,
                    "color_type": self.print_color_type,
                    "min_qty": ["<=", impressions],
                },
                fields=["name", "rate_per_1000", "min_qty", "max_qty"],
                order_by="min_qty desc",
            )

            if not rate_cards:
                frappe.msgprint(
                    f"Warning: No Printing Rate Card found for {self.printing_machine} / {self.print_colors}. Using 0 cost.",
                    alert=True
                )
                self.total_printing_cost = 0
                return

            # Select appropriate rate card
            selected = None
            for card in rate_cards:
                if not card.max_qty or impressions <= card.max_qty:
                    selected = card
                    break

            if selected:
                self.printing_rate_card = selected.name
                self.print_cost_per_1000 = selected.rate_per_1000 * color_count
                self.total_printing_cost = (self.print_cost_per_1000 / 1000.0) * (self.sheets_required or 0)
            else:
                self.total_printing_cost = 0

        except Exception as e:
            frappe.log_error(f"Error calculating printing cost: {str(e)}", "Pre Costing Order")
            frappe.msgprint(
                f"Error calculating printing cost: {str(e)}",
                alert=True
            )
            self.total_printing_cost = 0

    # ─── Step 5: Lamination Cost ───
    def _calculate_lamination_cost(self):
        """Calculate lamination cost with error handling"""
        try:
            if not self.lamination_required or not self.lamination_type:
                self.total_lamination_cost = 0
                return

            rate_card = frappe.db.get_value(
                "Lamination Rate Card",
                {"lamination_type": self.lamination_type},
                ["name", "rate_per_sq_inch", "min_charge"],
                as_dict=1,
            )

            if not rate_card:
                frappe.msgprint(
                    f"Warning: No Lamination Rate Card found for {self.lamination_type}. Using 0 cost.",
                    alert=True
                )
                self.total_lamination_cost = 0
                return

            w_in = (self.sheet_width_mm or 0) / 25.4
            h_in = (self.sheet_height_mm or 0) / 25.4
            area = w_in * h_in * (self.sheets_required or 0)
            total = area * (rate_card.rate_per_sq_inch or 0)
            if rate_card.min_charge and total < rate_card.min_charge:
                total = rate_card.min_charge
            self.total_lamination_cost = total

        except Exception as e:
            frappe.log_error(f"Error calculating lamination cost: {str(e)}", "Pre Costing Order")
            frappe.msgprint(
                f"Error calculating lamination cost: {str(e)}",
                alert=True
            )
            self.total_lamination_cost = 0

    # ─── Step 6: Die Cutting Cost ───
    def _calculate_die_cutting_cost(self):
        """Calculate die cutting cost with error handling"""
        try:
            if not self.die_cutting_required or not self.die_knife_type:
                self.total_die_cutting_cost = 0
                return

            sheets = self.sheets_required or 0
            rate_cards = frappe.db.get_list(
                "Die Cutting Rate Card",
                filters={"knife_type": self.die_knife_type, "min_qty": ["<=", sheets]},
                fields=["name", "rate_per_1000", "min_charge", "min_qty", "max_qty"],
                order_by="min_qty desc",
            )

            if not rate_cards:
                frappe.msgprint(
                    f"Warning: No Die Cutting Rate Card found for {self.die_knife_type}. Using die making cost only.",
                    alert=True
                )
                self.total_die_cutting_cost = float(self.die_making_cost or 0)
                return

            selected = None
            for card in rate_cards:
                if not card.max_qty or sheets <= card.max_qty:
                    selected = card
                    break

            if selected:
                self.die_cutting_rate_card = selected.name
                cost = (selected.rate_per_1000 / 1000.0) * sheets + float(self.die_making_cost or 0)
                if selected.min_charge and cost < selected.min_charge:
                    cost = selected.min_charge
                self.total_die_cutting_cost = cost
            else:
                self.total_die_cutting_cost = float(self.die_making_cost or 0)

        except Exception as e:
            frappe.log_error(f"Error calculating die cutting cost: {str(e)}", "Pre Costing Order")
            frappe.msgprint(
                f"Error calculating die cutting cost: {str(e)}",
                alert=True
            )
            self.total_die_cutting_cost = float(self.die_making_cost or 0)

    # ─── Step 7: Foaming ───
    def _calculate_foaming_cost(self):
        """Calculate foaming cost with error handling"""
        try:
            if not self.foaming_required:
                self.total_foaming_cost = 0
                return

            qty = self.target_qty or 0
            if qty <= 0:
                self.total_foaming_cost = 0
                return

            rate_cards = frappe.db.get_list(
                "Foaming Rate Card",
                filters={"min_qty": ["<=", qty]},
                fields=["rate_per_1000", "min_qty", "max_qty"],
                order_by="min_qty desc",
            )

            if not rate_cards:
                frappe.msgprint(
                    "Warning: No Foaming Rate Card found. Using 0 cost.",
                    alert=True
                )
                self.total_foaming_cost = 0
                return

            for card in rate_cards:
                if not card.max_qty or qty <= card.max_qty:
                    self.total_foaming_cost = (card.rate_per_1000 / 1000.0) * qty
                    return

            self.total_foaming_cost = 0

        except Exception as e:
            frappe.log_error(f"Error calculating foaming cost: {str(e)}", "Pre Costing Order")
            frappe.msgprint(
                f"Error calculating foaming cost: {str(e)}",
                alert=True
            )
            self.total_foaming_cost = 0

    # ─── Step 8: Additional Charges ───
    def _calculate_additional_charges(self):
        total = 0
        for row in self.get("additional_charges") or []:
            if row.charge_type == "Per Sheet":
                row.amount = float(row.rate or 0) * float(self.sheets_required or 0)
            elif row.charge_type == "Per 1000 Pcs":
                row.amount = (float(row.rate or 0) / 1000.0) * float(self.target_qty or 0)
            else:  # Fixed Amount
                row.amount = float(row.rate or 0)
            total += row.amount
        self.total_additional_charges = total

    # ─── Step 9: Final Summary ───
    def _calculate_final_costs(self):
        """Calculate final costs with validation"""
        total = (
            float(self.total_paper_cost or 0)
            + float(self.total_printing_cost or 0)
            + float(self.total_lamination_cost or 0)
            + float(self.total_die_cutting_cost or 0)
            + float(self.total_foaming_cost or 0)
            + float(self.total_additional_charges or 0)
            + float(self.packing_cost or 0)
            + float(self.poly_cost or 0)
            + float(self.delivery_cost or 0)
            + float(self.plate_cost or 0)
        )
        qty = float(self.target_qty or 0)
        self.total_production_cost = total
        self.cost_per_unit = total / qty if qty > 0 else 0
        self.conversion_cost = total - float(self.total_paper_cost or 0)
        markup = float(self.profit_markup or 25.0)
        self.selling_rate = self.cost_per_unit * (1.0 + markup / 100.0)

        # Validate costs
        self._validate_costs()

    def _validate_costs(self):
        """Validate cost calculations"""
        if self.selling_rate < self.cost_per_unit:
            frappe.msgprint(
                f"Warning: Selling rate (৳{self.selling_rate:.2f}) is less than cost (৳{self.cost_per_unit:.2f})",
                alert=True
            )

        if self.cost_per_unit > 0:
            margin = ((self.selling_rate - self.cost_per_unit) / self.cost_per_unit * 100)
            if margin < 10:
                frappe.msgprint(
                    f"Warning: Margin is only {margin:.1f}%. Consider increasing profit markup.",
                    alert=True
                )

    # ─── Step 10: Multi-Qty ───
    def _calculate_multi_qty(self):
        """Calculate costs for multiple quantities"""
        try:
            # Get quantities from Pre Costing Settings
            settings = frappe.get_single("Pre Costing Settings")
            qty_brackets = settings.get("quantity_brackets", [])

            if not qty_brackets:
                # Fallback to defaults
                default_qtys = [1000, 5000, 10000, 25000, 50000]
            else:
                default_qtys = [row.quantity for row in qty_brackets]

            self.set("multi_qty_comparison", [])
            for qty in default_qtys:
                cost = self._cost_for_qty(qty)
                self.append("multi_qty_comparison", {
                    "quantity": qty,
                    "sheets_required": cost["sheets"],
                    "total_cost": cost["total"],
                    "cost_per_unit": cost["cpu"],
                    "selling_rate": cost["cpu"] * (1 + float(self.profit_markup or 25) / 100),
                })
        except Exception as e:
            frappe.log_error(f"Error calculating multi-qty: {str(e)}", "Pre Costing Order")

    def _cost_for_qty(self, qty):
        """Calculate cost for a specific quantity"""
        try:
            ups = self.ups_per_sheet or 1
            waste_factor = 1 + (float(self.chaat_percent or 0) / 100.0)
            sheets = math.ceil((qty / ups) * waste_factor) if ups > 0 else 0

            # Paper cost
            paper = float(self.net_paper_rate or 0) * sheets

            # Printing cost (proportional to sheets)
            if self.sheets_required and self.sheets_required > 0:
                printing = (float(self.total_printing_cost or 0) / float(self.sheets_required)) * sheets
            else:
                printing = 0

            # Lamination cost (proportional to sheets)
            if self.sheets_required and self.sheets_required > 0:
                lamination = (float(self.total_lamination_cost or 0) / float(self.sheets_required)) * sheets
            else:
                lamination = 0

            # Die cutting cost (one-time + per-sheet)
            die = float(self.die_making_cost or 0)
            if self.sheets_required and self.sheets_required > 0:
                die_per_sheet = (float(self.total_die_cutting_cost or 0) - float(self.die_making_cost or 0)) / float(self.sheets_required)
                die += die_per_sheet * sheets

            # Foaming cost (proportional to quantity)
            if self.target_qty and self.target_qty > 0:
                foaming = (float(self.total_foaming_cost or 0) / float(self.target_qty)) * qty
            else:
                foaming = 0

            # Additional charges (proportional to quantity)
            if self.target_qty and self.target_qty > 0:
                additional = (float(self.total_additional_charges or 0) / float(self.target_qty)) * qty
            else:
                additional = 0

            # Other costs (one-time)
            other = float(self.packing_cost or 0) + float(self.poly_cost or 0) + float(self.delivery_cost or 0) + float(self.plate_cost or 0)

            # Total
            total = paper + printing + lamination + die + foaming + additional + other

            return {
                "sheets": sheets,
                "total": total,
                "cpu": total / qty if qty > 0 else 0
            }
        except Exception as e:
            frappe.log_error(f"Error calculating cost for qty {qty}: {str(e)}", "Pre Costing Order")
            return {"sheets": 0, "total": 0, "cpu": 0}

    # ─── Document Actions ───
    def on_submit(self):
        pass

    @frappe.whitelist()
    def make_quotation(self):
        if self.docstatus != 1:
            frappe.throw(_("Submit করুন তারপর Quotation বানানো যাবে।"))
        q = frappe.new_doc("Quotation")
        q.quotation_to = "Customer"
        if self.customer:
            q.party_name = self.customer
        q.company = self.company or frappe.defaults.get_user_default("Company")
        uom = frappe.db.get_value("Item", self.fg_item, "stock_uom") or "Nos"
        q.append("items", {
            "item_code": self.fg_item,
            "item_name": self.item_name,
            "qty": self.target_qty or 1,
            "rate": self.selling_rate or 0,
            "uom": uom,
        })
        q.insert()
        frappe.db.set_value("Pre Costing Order", self.name, "quotation", q.name)
        return q.name

    @frappe.whitelist()
    def make_bom(self):
        if self.docstatus != 1:
            frappe.throw(_("Submit করুন তারপর BOM বানানো যাবে।"))
        bom = frappe.new_doc("BOM")
        bom.item = self.fg_item
        bom.quantity = float(self.target_qty or 1)
        bom.rm_cost_as_per = "Valuation Rate"
        bom.is_active = 1
        bom.is_default = 1
        bom.company = self.company or frappe.defaults.get_user_default("Company")
        if self.paper_item:
            uom = frappe.db.get_value("Item", self.paper_item, "stock_uom") or "Sheet"
            bom.append("items", {
                "item_code": self.paper_item,
                "qty": float(self.sheets_required or 0),
                "uom": uom,
            })
        bom.save(ignore_permissions=True)
        frappe.db.set_value("Pre Costing Order", self.name, "bom", bom.name)
        return bom.name


def _get_item_rate(item_code):
    """Item-এর best buying rate fetch করো"""
    if not item_code:
        return 0
    price_list = (
        frappe.db.get_single_value("Pre Costing Settings", "buying_price_list")
        or "Standard Buying"
    )
    price = frappe.db.get_value(
        "Item Price",
        {"item_code": item_code, "price_list": price_list},
        "price_list_rate",
    )
    if price:
        return float(price)
    item_data = frappe.db.get_value(
        "Item", item_code, ["valuation_rate", "last_purchase_rate"], as_dict=1
    )
    if item_data:
        return float(item_data.valuation_rate or item_data.last_purchase_rate or 0)
    return 0
