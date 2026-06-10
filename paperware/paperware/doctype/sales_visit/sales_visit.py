# Copyright (c) 2026, Sayed and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe import _


class SalesVisit(Document):
	def validate(self):
		"""Validate the Sales Visit document"""
		# Handle New Lead creation logic
		if self.customer_or_lead == "Lead" and self.create_new_lead and self.new_lead_name:
			if not self.lead:
				new_lead = frappe.get_doc({
					"doctype": "Lead",
					"lead_name": self.new_lead_name,
					"mobile_no": self.new_lead_phone,
					"status": "Lead"
				})
				new_lead.insert(ignore_permissions=True)
				self.lead = new_lead.name
				# Clear flags to prevent re-creation
				self.create_new_lead = 0
				frappe.msgprint(_("New Lead {0} created successfully").format(self.lead))

		# Ensure either Customer or Lead is selected
		if not self.client_name and not self.lead:
			frappe.throw(_("Please select either a Customer or a Lead (or create a new one)"))

		# Set created_by to current user if not set
		if not self.created_by:
			self.created_by = frappe.session.user
		
		# Validate live visit - only one live visit per user at a time
		if self.is_live_visit:
			self.validate_live_visit()
			
		# Auto-add check-in log on first save of live visit
		if self.is_live_visit and self.is_new() and not self.visit_logs:
			self.add_log("Check-in", _("Started live visit"))
	
	def validate_live_visit(self):
		"""Ensure only one live visit per user at a time"""
		existing_live_visits = frappe.get_all(
			"Sales Visit",
			filters={
				"is_live_visit": 1,
				"created_by": frappe.session.user,
				"name": ["!=", self.name],
				"docstatus": ["<", 2],  # Not cancelled
				"status": ["not in", ["Completed", "Cancelled"]]
			}
		)
		
		if existing_live_visits:
			frappe.throw(
				_("You already have an active live visit. Please complete it before starting a new one.")
			)
		
		# Auto-clear is_live_visit on previously completed visits for this user
		old_completed = frappe.get_all(
			"Sales Visit",
			filters={
				"is_live_visit": 1,
				"created_by": frappe.session.user,
				"name": ["!=", self.name],
				"status": ["in", ["Completed", "Cancelled"]]
			},
			pluck="name"
		)
		for visit_name in old_completed:
			frappe.db.set_value("Sales Visit", visit_name, "is_live_visit", 0, update_modified=False)
	
	def add_log(self, log_type, note=None, gps_location=None):
		"""Helper to add a log entry"""
		self.append("visit_logs", {
			"log_datetime": frappe.utils.now_datetime(),
			"user": frappe.session.user,
			"log_type": log_type,
			"note": note,
			"gps_location": gps_location or self.gps_location
		})
	
	def on_submit(self):
		"""Actions to perform on submit"""
		# Auto-set status to Completed on submit
		if self.status == "Scheduled":
			self.db_set("status", "Completed")
		
		# Add check-out log if it was a live visit
		if self.is_live_visit:
			self.add_log("Check-out", _("Completed live visit"))
			self.db_set("is_live_visit", 0)
	
	def on_cancel(self):
		"""Actions to perform on cancel"""
		self.db_set("status", "Cancelled")
		self.add_log("Note", _("Visit cancelled"))


@frappe.whitelist()
def get_live_visits():
	"""Get all current live visits for dashboard"""
	return frappe.get_all(
		"Sales Visit",
		filters={
			"is_live_visit": 1,
			"docstatus": 0
		},
		fields=[
			"name",
			"client_name",
			"lead",
			"location_name",
			"visit_date",
			"visit_time",
			"purpose",
			"created_by",
			"gps_location"
		],
		order_by="modified desc"
	)


@frappe.whitelist()
def get_visit_statistics(period="today"):
	"""Get visit statistics for dashboard"""
	from frappe.utils import today, add_days, get_first_day, get_last_day
	
	if period == "today":
		start_date = today()
		end_date = today()
	elif period == "week":
		start_date = add_days(today(), -7)
		end_date = today()
	elif period == "month":
		start_date = get_first_day(today())
		end_date = get_last_day(today())
	else:
		start_date = today()
		end_date = today()
	
	# Get total visits
	total_visits = frappe.db.count(
		"Sales Visit",
		filters={
			"visit_date": ["between", [start_date, end_date]],
			"docstatus": ["<", 2]
		}
	)
	
	# Get visits by purpose
	purpose_breakdown = frappe.db.sql("""
		SELECT purpose, COUNT(*) as count
		FROM `tabSales Visit`
		WHERE visit_date BETWEEN %s AND %s
		AND docstatus < 2
		GROUP BY purpose
	""", (start_date, end_date), as_dict=True)
	
	# Get visits by status
	status_breakdown = frappe.db.sql("""
		SELECT status, COUNT(*) as count
		FROM `tabSales Visit`
		WHERE visit_date BETWEEN %s AND %s
		AND docstatus < 2
		GROUP BY status
	""", (start_date, end_date), as_dict=True)
	
	return {
		"total_visits": total_visits,
		"purpose_breakdown": purpose_breakdown,
		"status_breakdown": status_breakdown,
		"period": period
	}
@frappe.whitelist()
def get_recent_visits(limit=10):
	"""Get recent completed/submitted visits for activity feed"""
	return frappe.get_all(
		"Sales Visit",
		filters={
			"docstatus": ["<", 2],  # Not cancelled
			"status": ["!=", "Scheduled"]
		},
		fields=[
			"name",
			"client_name",
			"lead",
			"visit_date",
			"purpose",
			"created_by",
			"modified"
		],
		order_by="modified desc",
		limit=limit
	)
