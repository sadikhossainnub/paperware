# Copyright (c) 2026, Sadik Hossain and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import flt


class EmployeeOvertime(Document):
	def validate(self):
		self.calculate_amounts()
		self.validate_accounts()
		self.validate_shift_overlap()

	def validate_shift_overlap(self):
		if not self.shift_start_time or not self.shift_end_time or not self.start_time or not self.end_time:
			return

		# Helper to get continuous 0-48 hours
		def _hours(t):
			h = self.time_to_hours(t)
			return h

		s_start = _hours(self.shift_start_time)
		s_end = _hours(self.shift_end_time)
		if s_end < s_start:
			s_end += 24 # overnight shift

		o_start = _hours(self.start_time)
		o_end = _hours(self.end_time)
		if o_end < o_start:
			o_end += 24 # overnight overtime

		# If OT represents morning hours but shift was overnight
		if s_end > 24 and o_start < s_start and o_start < 12:
			o_start += 24
			o_end += 24
			
		# Overlap check: max(start1, start2) < min(end1, end2)
		overlap = max(s_start, o_start) < min(s_end, o_end)
		if overlap:
			frappe.throw(_("Overtime time ({0} to {1}) cannot overlap with regular Shift time ({2} to {3}).").format(
				self.start_time, self.end_time, self.shift_start_time, self.shift_end_time
			))

	def calculate_amounts(self):
		hours = 0
		if self.start_time and self.end_time:
			t1 = self.time_to_hours(self.start_time)
			t2 = self.time_to_hours(self.end_time)
			if t2 < t1:
				hours = (24 - t1) + t2 # Crosses midnight
			else:
				hours = t2 - t1
		
		# Round to 2 decimals
		self.overtime_hours = flt(hours, 2)
		self.overtime_amount = flt(self.overtime_hours) * flt(self.overtime_rate)
		self.total_amount = flt(self.overtime_amount) + flt(self.overtime_allowance)

	@staticmethod
	def time_to_hours(time_str):
		"""Convert 'HH:MM:SS' or 'HH:MM' time string to decimal hours."""
		if not time_str:
			return 0
		parts = str(time_str).split(":")
		hours = int(parts[0]) if len(parts) > 0 else 0
		minutes = int(parts[1]) if len(parts) > 1 else 0
		seconds = int(parts[2]) if len(parts) > 2 else 0
		return hours + (minutes / 60) + (seconds / 3600)

	def validate_accounts(self):
		# Accounts needed for: allowance JE, or separate payment mode JE
		needs_je = (
			(self.overtime_allowance and self.overtime_allowance > 0)
			or self.payment_mode == "Separate Payment"
		)
		if needs_je:
			if not self.expense_account:
				frappe.throw(_("Please set an Expense Account"))
			if not self.payment_account:
				frappe.throw(_("Please set a Payment Account (Cash/Bank)"))

	def on_submit(self):
		self.db_set("status", "Submitted")

		if self.payment_mode == "With Salary":
			# Overtime amount → Additional Salary → paid via monthly Salary Slip
			self.create_additional_salary()
		else:
			# Overtime amount → Journal Entry → paid immediately
			self.create_overtime_journal_entry()

		# Allowance/Bill always gets a separate Journal Entry
		self.create_allowance_journal_entry()

	def on_cancel(self):
		self.db_set("status", "Cancelled")
		self.cancel_additional_salary()
		self.cancel_journal_entry()

	def get_or_create_salary_component(self):
		"""Auto-create 'Overtime' Salary Component if it doesn't exist."""
		component_name = "Overtime"
		if not frappe.db.exists("Salary Component", component_name):
			sc = frappe.new_doc("Salary Component")
			sc.salary_component = component_name
			sc.salary_component_abbr = "OT"
			sc.type = "Earning"
			sc.insert(ignore_permissions=True)
			frappe.msgprint(
				_("Salary Component '{0}' has been automatically created").format(component_name),
				alert=True
			)
		return component_name

	def create_additional_salary(self):
		"""Create Additional Salary for the overtime hours amount (paid via Salary Slip)."""
		if not self.overtime_amount or self.overtime_amount <= 0:
			return

		salary_component = self.get_or_create_salary_component()

		additional_salary = frappe.new_doc("Additional Salary")
		additional_salary.employee = self.employee
		additional_salary.salary_component = salary_component
		additional_salary.amount = self.overtime_amount
		additional_salary.payroll_date = self.date
		additional_salary.company = self.company
		additional_salary.overwrite_salary_structure_amount = 0
		additional_salary.ref_doctype = self.doctype
		additional_salary.ref_docname = self.name
		additional_salary.submit()

		self.db_set("additional_salary", additional_salary.name)
		frappe.msgprint(
			_("Additional Salary {0} created for {1}").format(
				frappe.utils.get_link_to_form("Additional Salary", additional_salary.name),
				frappe.format(self.overtime_amount, {"fieldtype": "Currency"})
			),
			alert=True
		)

	def create_overtime_journal_entry(self):
		"""Create Journal Entry for overtime amount (Separate Payment mode)."""
		if not self.overtime_amount or self.overtime_amount <= 0:
			return

		je = frappe.new_doc("Journal Entry")
		je.voucher_type = "Journal Entry"
		je.posting_date = self.date
		je.company = self.company
		je.user_remark = _("Overtime Payment for {0} - {1} on {2}").format(
			self.employee, self.employee_name, self.date
		)

		# Debit: Expense Account
		je.append("accounts", {
			"account": self.expense_account,
			"debit_in_account_currency": flt(self.overtime_amount),
			"credit_in_account_currency": 0,
			"cost_center": frappe.db.get_value("Company", self.company, "cost_center"),
		})

		# Credit: Payment Account (Cash/Bank)
		je.append("accounts", {
			"account": self.payment_account,
			"debit_in_account_currency": 0,
			"credit_in_account_currency": flt(self.overtime_amount),
		})

		je.submit()

		self.db_set("journal_entry", je.name)
		frappe.msgprint(
			_("Journal Entry {0} created for Overtime Payment of {1}").format(
				frappe.utils.get_link_to_form("Journal Entry", je.name),
				frappe.format(self.overtime_amount, {"fieldtype": "Currency"})
			),
			alert=True
		)

	def create_allowance_journal_entry(self):
		"""Create Journal Entry for the Overtime Allowance / Bill (always separate)."""
		if not self.overtime_allowance or self.overtime_allowance <= 0:
			return

		je = frappe.new_doc("Journal Entry")
		je.voucher_type = "Journal Entry"
		je.posting_date = self.date
		je.company = self.company
		je.user_remark = _("Overtime Allowance / Bill for {0} - {1} on {2}").format(
			self.employee, self.employee_name, self.date
		)

		# Debit: Expense Account
		je.append("accounts", {
			"account": self.expense_account,
			"debit_in_account_currency": flt(self.overtime_allowance),
			"credit_in_account_currency": 0,
			"cost_center": frappe.db.get_value("Company", self.company, "cost_center"),
		})

		# Credit: Payment Account (Cash/Bank)
		je.append("accounts", {
			"account": self.payment_account,
			"debit_in_account_currency": 0,
			"credit_in_account_currency": flt(self.overtime_allowance),
		})

		je.submit()

		# Store in a second reference field or append to journal_entry
		# If overtime JE already exists, store allowance JE name in remark
		if not self.journal_entry:
			self.db_set("journal_entry", je.name)

		frappe.msgprint(
			_("Journal Entry {0} created for Overtime Allowance of {1}").format(
				frappe.utils.get_link_to_form("Journal Entry", je.name),
				frappe.format(self.overtime_allowance, {"fieldtype": "Currency"})
			),
			alert=True
		)

	def cancel_additional_salary(self):
		"""Cancel the linked Additional Salary on cancellation."""
		if self.additional_salary:
			additional_salary = frappe.get_doc("Additional Salary", self.additional_salary)
			if additional_salary.docstatus == 1:
				additional_salary.cancel()
			self.db_set("additional_salary", "")

	def cancel_journal_entry(self):
		"""Cancel the linked Journal Entry on cancellation."""
		if self.journal_entry:
			je = frappe.get_doc("Journal Entry", self.journal_entry)
			if je.docstatus == 1:
				je.cancel()
			self.db_set("journal_entry", "")

@frappe.whitelist()
def get_shift_and_attendance(employee, date):
	if not employee or not date:
		return {}

	shift_name = None
	shift_start_time = None
	shift_end_time = None

	try:
		from hrms.hr.doctype.shift_assignment.shift_assignment import get_employee_shift
		shift_details = get_employee_shift(employee, date, consider_default_shift=True)
		if shift_details:
			shift_name = shift_details.shift_type.name
			shift_start_time = shift_details.shift_type.start_time
			shift_end_time = shift_details.shift_type.end_time
	except Exception:
		pass

	# Fetch checkins
	checkins = frappe.get_all(
		"Employee Checkin",
		filters={"employee": employee, "time": (">=", f"{date} 00:00:00"), "time": ("<=", f"{date} 23:59:59")},
		fields=["time"],
		order_by="time asc"
	)

	in_time = checkins[0].time if checkins else None
	out_time = checkins[-1].time if checkins else None

	return {
		"shift": shift_name,
		"shift_start_time": shift_start_time,
		"shift_end_time": shift_end_time,
		"actual_check_in": in_time,
		"actual_check_out": out_time
	}
