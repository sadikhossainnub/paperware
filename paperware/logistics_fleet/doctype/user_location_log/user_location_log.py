# Copyright (c) 2026, abu sayed and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document

class UserLocationLog(Document):
	def validate(self):
		if not self.user:
			self.user = frappe.session.user

@frappe.whitelist()
def log_location(latitude, longitude, accuracy=None, speed=None, battery_level=None, device_id=None):
	"""
	API endpoint to log user location from mobile app.
	Usage: POST /api/method/paperware.logistics_fleet.doctype.user_location_log.user_location_log.log_location
	"""
	try:
		# Create new log entry
		doc = frappe.get_doc({
			"doctype": "User Location Log",
			"user": frappe.session.user,
			"timestamp": frappe.utils.now_datetime(),
			"latitude": latitude,
			"longitude": longitude,
			"accuracy": accuracy,
			"speed": speed,
			"battery_level": battery_level,
			"device_id": device_id
		})
		doc.insert(ignore_permissions=True)
		
		return {"status": "success", "message": "Location logged"}
	except Exception as e:
		frappe.log_error(f"Location Log Error: {str(e)}")
		return {"status": "error", "message": str(e)}

@frappe.whitelist()
def get_latest_locations():
	"""
	Get the last known location of all tracked users for the dashboard map.
	"""
	# Subquery to get the latest timestamp for each user
	latest_logs = frappe.db.sql("""
		SELECT 
			t1.user, t1.latitude, t1.longitude, t1.timestamp, t1.battery_level,
			users.full_name, users.user_image
		FROM `tabUser Location Log` t1
		JOIN (
			SELECT user, MAX(timestamp) as max_timestamp
			FROM `tabUser Location Log`
			GROUP BY user
		) t2 ON t1.user = t2.user AND t1.timestamp = t2.max_timestamp
		JOIN `tabUser` users ON t1.user = users.name
		WHERE t1.timestamp >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
	""", as_dict=True)
	
	return latest_logs

@frappe.whitelist()
def get_user_location_history(user, date):
	"""
	Get location history for a specific user on a specific date for timeline view.
	"""
	start_of_day = f"{date} 00:00:00"
	end_of_day = f"{date} 23:59:59"
	
	logs = frappe.get_all(
		"User Location Log",
		filters={
			"user": user,
			"timestamp": ["between", [start_of_day, end_of_day]]
		},
		fields=["timestamp", "latitude", "longitude", "accuracy", "speed", "battery_level", "address"],
		order_by="timestamp asc"
	)
	
	return logs
