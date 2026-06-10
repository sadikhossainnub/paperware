import frappe
import requests
from frappe.model.document import Document
from frappe.utils import now_datetime, flt, get_datetime

class Vehicle(Document):
	@frappe.whitelist()
	def sync_gps(self):
		settings = frappe.get_single("GPS Settings")
		if not settings.api_key or not self.gps_device_id:
			frappe.msgprint("Please setup GPS Settings and Device ID first.")
			return

		url = f"{settings.server_url.strip('/')}/api/get_devices"
		params = {
			"user_api_hash": settings.get_password("api_key"),
			"lang": "en"
		}

		try:
			response = requests.get(url, params=params, timeout=15, verify=bool(settings.verify_ssl))
			response.raise_for_status()
			data = response.json()
			
			# Ensure data is parsed correctly (sometimes it returns a list of groups)
			if isinstance(data, dict):
				data = [data] # wrap in list if it's a single dict

			# Find the specific device
			target_device = None
			for group in data:
				items = group.get('items', []) if isinstance(group, dict) else []
				for device in items:
					if str(device.get('id')) == str(self.gps_device_id):
						target_device = device
						break
				if target_device: break

			if target_device:
				# Use db_set to allow updates even if the document is submitted
				self.db_set('last_latitude', target_device.get('lat'))
				self.db_set('last_longitude', target_device.get('lng'))
				self.db_set('last_speed', f"{target_device.get('speed', 0)} km/h")
				self.db_set('last_sync', frappe.utils.now_datetime())
				
				new_status = "Active" if target_device.get('online') == "online" else "Inactive"
				self.db_set('status', new_status)
				
				return target_device
			else:
				frappe.msgprint(f"Device ID {self.gps_device_id} not found in your Autonemo account.")
		except Exception as e:
			frappe.log_error(f"GPS Sync Error: {str(e)}")
			frappe.msgprint(f"Error syncing with GPS server: {str(e)}")

	def validate(self):
		self.check_document_expiry()

	def check_document_expiry(self):
		from frappe.utils import getdate, add_days, today
		upcoming_expiry = []
		fields = [
			("tax_token_expiry", "Tax Token"),
			("fitness_expiry", "Fitness"),
			("route_permit_expiry", "Route Permit"),
			("insurance_expiry", "Insurance")
		]
		
		warning_date = add_days(today(), 30)
		
		for field, label in fields:
			expiry_date = getattr(self, field)
			if expiry_date:
				if getdate(expiry_date) <= getdate(warning_date):
					upcoming_expiry.append(f"{label} ({expiry_date})")
					
		if upcoming_expiry:
			frappe.msgprint(frappe._("The following documents are expiring soon: {0}").format(", ".join(upcoming_expiry)))

	def on_update(self):
		pass

@frappe.whitelist()
def get_all_devices():
	settings = frappe.get_single("GPS Settings")
	if not settings.api_key:
		frappe.throw("Please setup GPS Settings (API Key) first.")

	url = f"{settings.server_url.strip('/')}/api/get_devices"
	params = {
		"user_api_hash": settings.get_password("api_key"),
		"lang": "en"
	}

	try:
		# Use settings.verify_ssl to control SSL verification
		response = requests.get(url, params=params, timeout=15, verify=bool(settings.verify_ssl))
		response.raise_for_status()
		data = response.json()
		
		# Robust parsing for Autonemo response format
		if isinstance(data, dict):
			data = [data]

		devices = []
		for group in data:
			items = group.get('items', []) if isinstance(group, dict) else []
			for item in items:
				devices.append({
					"id": item.get('id'),
					"name": item.get('name'),
					"online": item.get('online'),
					"lat": flt(item.get('lat')),
					"lng": flt(item.get('lng'))
				})
		return devices
	except Exception as e:
		frappe.throw(f"Error fetching devices: {str(e)}")
