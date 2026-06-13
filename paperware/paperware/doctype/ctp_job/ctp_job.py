# Copyright (c) 2026, abu sayed and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import today, add_days, now_datetime


STAGE_ORDER = [
    "Printing",
    "Drying",
    "Lamination",
    "Die Cutting",
    "Foaming",
    "Quality Check",
    "Ready to Deliver",
    "Delivered",
]


class CTPJob(Document):

    # ─── Lifecycle Hooks ───────────────────────────────────────────────

    def validate(self):
        self._calculate_wastage_percentage()
        self._set_scheduling_bucket()
        self._handle_plate_received()
        self._validate_foaming_stage()

    def before_save(self):
        pass

    def on_update(self):
        self._mirror_to_pre_costing()

    # ─── Validation Helpers ────────────────────────────────────────────

    def _calculate_wastage_percentage(self):
        """Auto-calculate wastage % from sheets printed and wasted."""
        printed = int(self.sheets_printed or 0)
        wasted = int(self.sheets_wasted or 0)
        if printed > 0:
            self.wastage_percentage = round((wasted / printed) * 100, 2)
        else:
            self.wastage_percentage = 0

    def _set_scheduling_bucket(self):
        """Categorise into Today / Tomorrow / Later based on required_by_factory_date."""
        if not self.required_by_factory_date:
            self.scheduling_bucket = "Later"
            return

        req_date = str(self.required_by_factory_date)
        today_str = str(today())
        tomorrow_str = str(add_days(today(), 1))

        if req_date == today_str:
            self.scheduling_bucket = "Today"
        elif req_date == tomorrow_str:
            self.scheduling_bucket = "Tomorrow"
        else:
            self.scheduling_bucket = "Later"

    def _handle_plate_received(self):
        """
        When the plate status is first set to Received, transition the job
        from Pending → Active Production and set current_stage = Printing.
        """
        if self.plate_status == "Received" and self.status == "Pending":
            self.status = "Active Production"
            if not self.current_stage:
                self.current_stage = "Printing"

    def _validate_foaming_stage(self):
        """Ensure leakage check is acknowledged when stage reaches Foaming."""
        if self.current_stage == "Foaming" and not self.leakage_check_passed:
            frappe.msgprint(
                _("Warning: Leakage check has not been confirmed for the Foaming stage."),
                alert=True
            )

    # ─── State Mirroring ──────────────────────────────────────────────

    def _mirror_to_pre_costing(self):
        """
        Mirror status and current_stage to the linked Pre Costing Order.
        This implements the 'double state sync' requirement so the costing
        record always reflects the live production state.
        """
        if not self.pre_costing_order:
            return

        try:
            # Only update if the PCO actually has our mirror fields
            pco_fields = frappe.db.get_value(
                "Pre Costing Order",
                self.pre_costing_order,
                ["name", "ctp_status", "ctp_stage", "ctp_job"],
                as_dict=True,
            )

            if not pco_fields:
                return

            frappe.db.set_value(
                "Pre Costing Order",
                self.pre_costing_order,
                {
                    "ctp_status": self.status,
                    "ctp_stage": self.current_stage or "",
                    "ctp_job": self.name,
                },
                update_modified=False,
            )

        except Exception as e:
            frappe.log_error(
                f"CTP Job mirror failed for {self.name}: {str(e)}",
                "CTP Job Mirror Error"
            )

    # ─── Stage Advance Helper ─────────────────────────────────────────

    def advance_stage(self, worker=None, gps_location=None, attachment=None):
        """
        Advance the job to the next stage in the pipeline and log the transition.
        Called internally or via the sync API.
        """
        if not self.current_stage:
            self.current_stage = "Printing"
        elif self.current_stage == "Delivered":
            frappe.throw(_("Job is already at the final stage: Delivered."))
        else:
            current_idx = STAGE_ORDER.index(self.current_stage)
            next_idx = current_idx + 1
            if next_idx < len(STAGE_ORDER):
                self.current_stage = STAGE_ORDER[next_idx]

        # Mark as Completed when reaching Delivered
        if self.current_stage == "Delivered":
            self.status = "Completed"

        # Append a log entry
        self.append("logs", {
            "stage": self.current_stage,
            "worker": worker or frappe.session.user,
            "started_time": now_datetime(),
            "gps_location": gps_location or "",
            "attachments": attachment or "",
        })

        self.save(ignore_permissions=True)


# ─── Whitelisted API Endpoints ─────────────────────────────────────────────────

@frappe.whitelist()
def sync_ctp_job(order_name, payload):
    """
    Primary API called by the client (mobile/web) to push a CTP job state update.

    Args:
        order_name (str): The Pre Costing Order name (e.g. PCO-2026-00001).
        payload (dict | str): JSON object containing state data to be applied.
            Supported keys:
                plate_status, status, current_stage, plate_supplier,
                required_by_factory_date, sheets_printed, sheets_wasted,
                ink_cost, color_density_notes, die_type, die_supplier,
                sheet_size, die_ups_per_sheet, creasing_lines, embossing,
                die_eta, leakage_check_passed,
                worker, gps_location, attachment,
                advance (bool) – if True, advance to the next stage.

    Returns:
        dict: Updated job name, status, current_stage, scheduling_bucket.
    """
    import json

    if isinstance(payload, str):
        payload = json.loads(payload)

    # Get or create the CTP Job linked to this PCO
    existing = frappe.db.get_value(
        "CTP Job", {"pre_costing_order": order_name}, "name"
    )

    if existing:
        job = frappe.get_doc("CTP Job", existing)
    else:
        job = frappe.new_doc("CTP Job")
        job.pre_costing_order = order_name

    # Apply scalar fields from payload
    SCALAR_FIELDS = [
        "plate_status", "status", "current_stage", "plate_supplier",
        "required_by_factory_date", "sheets_printed", "sheets_wasted",
        "ink_cost", "color_density_notes", "die_type", "die_supplier",
        "sheet_size", "die_ups_per_sheet", "creasing_lines",
        "embossing", "die_eta", "leakage_check_passed",
    ]
    for field in SCALAR_FIELDS:
        if field in payload:
            setattr(job, field, payload[field])

    # Optionally advance to the next stage
    if payload.get("advance"):
        # advance_stage saves internally, so we return early
        job.save(ignore_permissions=True)
        job.reload()
        job.advance_stage(
            worker=payload.get("worker"),
            gps_location=payload.get("gps_location"),
            attachment=payload.get("attachment"),
        )
        job.reload()
        return _job_response(job)

    # Otherwise just append a log entry if location/worker provided
    if payload.get("worker") or payload.get("gps_location"):
        job.append("logs", {
            "stage": job.current_stage or "",
            "worker": payload.get("worker") or frappe.session.user,
            "started_time": now_datetime(),
            "gps_location": payload.get("gps_location") or "",
            "attachments": payload.get("attachment") or "",
        })

    job.save(ignore_permissions=True)
    return _job_response(job)


@frappe.whitelist()
def get_ctp_jobs(bucket=None):
    """
    Fetch all CTP Jobs, optionally filtered by scheduling_bucket.

    Args:
        bucket (str|None): "Today", "Tomorrow", "Later", or None for all.

    Returns:
        list[dict]: List of CTP Job records.
    """
    filters = {}
    if bucket:
        filters["scheduling_bucket"] = bucket

    jobs = frappe.get_all(
        "CTP Job",
        filters=filters,
        fields=[
            "name", "pre_costing_order", "plate_supplier",
            "required_by_factory_date", "status", "plate_status",
            "current_stage", "scheduling_bucket",
            "sheets_printed", "sheets_wasted", "wastage_percentage",
            "ink_cost", "modified",
        ],
        order_by="required_by_factory_date asc, modified desc",
    )
    return jobs


@frappe.whitelist()
def get_ctp_job_by_order(order_name):
    """
    Fetch a CTP Job by its linked Pre Costing Order name.

    Args:
        order_name (str): Pre Costing Order name.

    Returns:
        dict|None: Full CTP Job document dict, or None if not found.
    """
    name = frappe.db.get_value(
        "CTP Job", {"pre_costing_order": order_name}, "name"
    )
    if not name:
        return None
    return frappe.get_doc("CTP Job", name).as_dict()


# ─── Internal Helpers ──────────────────────────────────────────────────────────

def _job_response(job):
    """Return a concise response dict for the client."""
    return {
        "job": job.name,
        "status": job.status,
        "current_stage": job.current_stage,
        "scheduling_bucket": job.scheduling_bucket,
        "wastage_percentage": job.wastage_percentage,
    }
