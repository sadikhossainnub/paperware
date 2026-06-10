import frappe
from frappe.model.document import Document

class FuelLog(Document):
	def validate(self):
		self.calculate_mileage()

	def calculate_mileage(self):
		if self.vehicle and self.odometer and self.liters:
			# Get previous fuel log for this vehicle
			last_fuel_log = frappe.get_all("Fuel Log", 
				filters={
					"vehicle": self.vehicle,
					"date": ["<=", self.date],
					"name": ["!=", self.name]
				},
				fields=["odometer", "date"],
				order_by="date desc, creation desc",
				limit=1
			)
			
			if last_fuel_log and last_fuel_log[0].odometer:
				prev_odo = last_fuel_log[0].odometer
				if self.odometer > prev_odo:
					distance = self.odometer - prev_odo
					self.mileage = distance / self.liters
				else:
					self.mileage = 0
			else:
				self.mileage = 0
