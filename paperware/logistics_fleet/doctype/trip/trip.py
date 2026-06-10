import frappe
from frappe.model.document import Document
from frappe import _
from frappe.utils import get_datetime

class Trip(Document):
	def validate(self):
		self.validate_times()
		self.validate_overlap()
		self.calculate_distance()

	def calculate_distance(self):
		if self.start_odometer and self.end_odometer:
			if self.end_odometer < self.start_odometer:
				frappe.throw(_("End Odometer cannot be less than Start Odometer"))
			self.total_distance = self.end_odometer - self.start_odometer
		else:
			self.total_distance = 0

	def validate_times(self):
		if self.start_time and self.end_time:
			if get_datetime(self.end_time) <= get_datetime(self.start_time):
				frappe.throw(_("End Time must be after Start Time"))

	def validate_overlap(self):
		if self.trip_status == "Running":
			# Check driver
			active_driver_trip = frappe.db.exists("Trip", {
				"driver": self.driver,
				"trip_status": "Running",
				"name": ["!=", self.name]
			})
			if active_driver_trip:
				frappe.throw(_("Driver {0} is already on another active trip: {1}").format(self.driver, active_driver_trip))

			# Check vehicle
			active_vehicle_trip = frappe.db.exists("Trip", {
				"vehicle": self.vehicle,
				"trip_status": "Running",
				"name": ["!=", self.name]
			})
			if active_vehicle_trip:
				frappe.throw(_("Vehicle {0} is already on another active trip: {1}").format(self.vehicle, active_vehicle_trip))
