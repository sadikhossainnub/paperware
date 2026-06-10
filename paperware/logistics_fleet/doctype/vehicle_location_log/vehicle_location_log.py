# Copyright (c) 2026, abu sayed and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import now_datetime, add_to_date, get_datetime, time_diff_in_seconds, flt
import requests

class VehicleLocationLog(Document):
    def validate(self):
        # Auto-detect stop points based on speed
        if self.speed is not None and float(self.speed) < 2:
            # Check if previous log was also stationary
            prev_log = frappe.get_all(
                "Vehicle Location Log",
                filters={
                    "vehicle": self.vehicle,
                    "timestamp": ["<", self.timestamp],
                    "name": ["!=", self.name or ""]
                },
                fields=["timestamp", "speed", "is_stop"],
                order_by="timestamp desc",
                limit=1
            )
            if prev_log and prev_log[0].speed is not None and float(prev_log[0].speed) < 2:
                duration = time_diff_in_seconds(self.timestamp, prev_log[0].timestamp) / 60  # minutes
                if duration >= 5:  # 5 minute threshold for stop
                    self.is_stop = 1
                    self.stop_duration = int(duration)


@frappe.whitelist()
def log_vehicle_location(vehicle, latitude, longitude, speed=None, heading=None, accuracy=None, ignition_status=None, timestamp=None):
    """
    API endpoint to log vehicle location.
    Can be called from GPS tracking system or mobile app.
    """
    try:
        doc = frappe.get_doc({
            "doctype": "Vehicle Location Log",
            "vehicle": vehicle,
            "timestamp": timestamp or now_datetime(),
            "latitude": flt(latitude),
            "longitude": flt(longitude),
            "speed": flt(speed),
            "heading": flt(heading),
            "accuracy": flt(accuracy),
            "ignition_status": ignition_status
        })
        doc.insert(ignore_permissions=True)
        
        # Update vehicle's last known location
        frappe.db.set_value("Vehicle", vehicle, {
            "last_latitude": latitude,
            "last_longitude": longitude,
            "last_speed": f"{speed or 0} km/h",
            "last_sync": now_datetime()
        })
        
        return {"status": "success", "message": "Location logged", "name": doc.name}
    except Exception as e:
        frappe.log_error(f"Vehicle Location Log Error: {str(e)}")
        return {"status": "error", "message": str(e)}


@frappe.whitelist()
def get_vehicle_history(vehicle, date):
    """
    Get location history for a specific vehicle on a specific date.
    Returns list of location points with stop information.
    """
    start_of_day = f"{date} 00:00:00"
    end_of_day = f"{date} 23:59:59"
    
    logs = frappe.get_all(
        "Vehicle Location Log",
        filters={
            "vehicle": vehicle,
            "timestamp": ["between", [start_of_day, end_of_day]]
        },
        fields=["name", "timestamp", "latitude", "longitude", "speed", "heading", 
                "accuracy", "ignition_status", "is_stop", "stop_duration", "address"],
        order_by="timestamp asc"
    )
    
    # Calculate statistics
    stats = calculate_trip_stats(logs)
    
    return {
        "logs": logs,
        "stats": stats
    }


def calculate_trip_stats(logs):
    """Calculate trip statistics from location logs."""
    if not logs:
        return {
            "total_distance": 0,
            "travel_time": 0,
            "stop_count": 0,
            "total_stop_time": 0,
            "max_speed": 0,
            "avg_speed": 0
        }
    
    from math import radians, sin, cos, sqrt, atan2
    
    def haversine(lat1, lon1, lat2, lon2):
        """Calculate distance between two points in km."""
        R = 6371  # Earth's radius in km
        
        lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        
        a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
        c = 2 * atan2(sqrt(a), sqrt(1-a))
        
        return R * c
    
    total_distance = 0
    speeds = []
    stop_count = 0
    total_stop_time = 0
    
    for i in range(1, len(logs)):
        prev = logs[i-1]
        curr = logs[i]
        
        # Calculate distance
        dist = haversine(
            float(prev.latitude), float(prev.longitude),
            float(curr.latitude), float(curr.longitude)
        )
        total_distance += dist
        
        # Track speeds
        if curr.speed:
            speeds.append(float(curr.speed))
        
        # Track stops
        if curr.is_stop:
            stop_count += 1
            total_stop_time += curr.stop_duration or 0
    
    # Calculate travel time (first to last log)
    if len(logs) >= 2:
        travel_time = time_diff_in_seconds(logs[-1].timestamp, logs[0].timestamp) / 60  # minutes
    else:
        travel_time = 0
    
    return {
        "total_distance": round(total_distance, 2),
        "travel_time": round(travel_time, 0),
        "stop_count": stop_count,
        "total_stop_time": total_stop_time,
        "max_speed": round(max(speeds), 1) if speeds else 0,
        "avg_speed": round(sum(speeds) / len(speeds), 1) if speeds else 0
    }


@frappe.whitelist()
def get_vehicles_with_history():
    """Get list of vehicles that have location history."""
    vehicles = frappe.get_all(
        "Vehicle",
        filters={"docstatus": ["!=", 2]},
        fields=["name", "vehicle_number", "vehicle_type", "current_driver", "status"]
    )
    return vehicles


@frappe.whitelist()
def sync_vehicle_history_from_gps(vehicle, date=None):
    """
    Sync vehicle location history from Autonemo GPS API.
    If date is not provided, syncs today's data.
    
    Autonemo API may use different endpoints for history:
    - /api/get_history - requires device_id, from_date, to_date
    - /api/device_history - alternative endpoint
    """
    from frappe.utils import today
    
    vehicle_doc = frappe.get_doc("Vehicle", vehicle)
    if not vehicle_doc.gps_device_id:
        return {"status": "error", "message": "No GPS Device ID configured for this vehicle"}
    
    settings = frappe.get_single("GPS Settings")
    if not settings.api_key:
        return {"status": "error", "message": "GPS Settings not configured"}
    
    target_date = date or today()
    api_key = settings.get_password("api_key")
    server_url = settings.server_url.strip('/')
    
    # Try different API endpoint formats (GPSWox API requires separate date and time params)
    endpoints_to_try = [
        {
            "url": f"{server_url.strip('/')}/api/get_history",
            "params": {
                "user_api_hash": api_key,
                "device_id": vehicle_doc.gps_device_id,
                "from_date": target_date,  # YYYY-MM-DD format
                "from_time": "00:00:00",   # HH:MM:SS format  
                "to_date": target_date,
                "to_time": "23:59:59",
                "lang": "en"
            }
        },
        {
            "url": f"{server_url.strip('/')}/api/get_history_messages",
            "params": {
                "user_api_hash": api_key,
                "device_id": vehicle_doc.gps_device_id,
                "from_date": target_date,
                "from_time": "00:00:00",
                "to_date": target_date,
                "to_time": "23:59:59",
                "lang": "en",
                "limit": 1000
            }
        }
    ]
    
    last_error = None
    
    for endpoint in endpoints_to_try:
        try:
            response = requests.get(
                endpoint["url"], 
                params=endpoint["params"], 
                timeout=30, 
                verify=bool(settings.verify_ssl)
            )
            
            # If we get a valid JSON response (even if empty)
            if response.status_code == 200:
                data = response.json()
                
                # Process and insert location points
                items = []
                if isinstance(data, dict):
                    items = data.get('items', data.get('positions', data.get('data', [])))
                elif isinstance(data, list):
                    items = data
                
                count = 0
                for item in items:
                    # Robust timestamp handling
                    raw_timestamp = item.get('timestamp') or item.get('time') or item.get('dt')
                    if not raw_timestamp:
                        continue
                        
                    # Convert to Frappe datetime string for consistent matching
                    try:
                        timestamp_val = get_datetime(raw_timestamp)
                    except:
                        continue
                        
                    exists = frappe.db.exists("Vehicle Location Log", {
                        "vehicle": vehicle,
                        "timestamp": timestamp_val
                    })
                    
                    if not exists:
                        try:
                            # Safely extract coordinates
                            lat = item.get('lat') or item.get('latitude')
                            lng = item.get('lng') or item.get('longitude') or item.get('lon')
                            
                            if lat is not None and lng is not None:
                                log_vehicle_location(
                                    vehicle=vehicle,
                                    latitude=lat,
                                    longitude=lng,
                                    speed=item.get('speed'),
                                    heading=item.get('course') or item.get('heading') or item.get('angle'),
                                    ignition_status="On" if item.get('ignition') or item.get('acc') else "Off",
                                    timestamp=timestamp_val
                                )
                                count += 1
                        except Exception as e:
                            frappe.log_error(f"Failed to log location point: {str(e)}", "GPS Sync Item Error")
                
                return {"status": "success", "message": f"Synced {count} location points from {len(items)} records"}
            
            elif response.status_code == 422:
                last_error = f"API validation error (422) for endpoint {endpoint['url']}"
                continue
            else:
                last_error = f"API returned status {response.status_code}"
                continue
                
        except requests.exceptions.RequestException as e:
            last_error = str(e)
            continue
    
    # If all endpoints failed
    frappe.log_error(f"GPS History Sync Error: {last_error}", "GPS Sync Failed")
    return {
        "status": "error", 
        "message": f"Could not fetch history from GPS server. The API may not support historical data retrieval. Error: {last_error}"
    }


def sync_all_vehicles_current_location():
    """
    Scheduled job to sync current GPS location for all active vehicles.
    This builds up location history over time by periodically logging current positions.
    
    Add to hooks.py:
    scheduler_events = {
        "cron": {
            "*/5 * * * *": [
                "paperware.logistics_fleet.doctype.vehicle_location_log.vehicle_location_log.sync_all_vehicles_current_location"
            ]
        }
    }
    """
    vehicles = frappe.get_all(
        "Vehicle",
        filters={
            "docstatus": 1,
            "gps_device_id": ["is", "set"],
            "status": ["in", ["Active", "In Use"]]
        },
        fields=["name", "gps_device_id"]
    )
    
    if not vehicles:
        return
    
    settings = frappe.get_single("GPS Settings")
    if not settings.api_key:
        return
    
    api_key = settings.get_password("api_key")
    server_url = settings.server_url.strip('/')
    
    try:
        response = requests.get(
            f"{server_url.strip('/')}/api/get_devices",
            params={"user_api_hash": api_key, "lang": "en"},
            timeout=15,
            verify=bool(settings.verify_ssl)
        )
        response.raise_for_status()
        data = response.json()
        
        all_devices = {}
        if isinstance(data, dict):
            data = [data]
        for group in data:
            items = group.get('items', []) if isinstance(group, dict) else []
            for device in items:
                all_devices[str(device.get('id'))] = device
        
        for vehicle in vehicles:
            device = all_devices.get(str(vehicle.gps_device_id))
            if device and device.get('lat') and device.get('lng'):
                try:
                    log_vehicle_location(
                        vehicle=vehicle.name,
                        latitude=device.get('lat'),
                        longitude=device.get('lng'),
                        speed=device.get('speed'),
                        heading=device.get('course'),
                        ignition_status="On" if device.get('online') == "online" else "Off"
                    )
                except Exception as e:
                    frappe.log_error(f"Failed to log location for {vehicle.name}: {str(e)}", "GPS Auto Sync Error")
                    
    except Exception as e:
        frappe.log_error(f"GPS Auto Sync Failed: {str(e)}", "GPS Auto Sync Error")


@frappe.whitelist()
def sync_current_location_for_vehicle(vehicle):
    """
    Sync current GPS location for a specific vehicle and log to history.
    """
    vehicle_doc = frappe.get_doc("Vehicle", vehicle)
    if not vehicle_doc.gps_device_id:
        return {"status": "error", "message": "No GPS Device ID configured"}
    
    result = vehicle_doc.sync_gps()
    
    if result:
        try:
            log_vehicle_location(
                vehicle=vehicle,
                latitude=result.get('lat'),
                longitude=result.get('lng'),
                speed=result.get('speed'),
                heading=result.get('course'),
                ignition_status="On" if result.get('online') == "online" else "Off"
            )
            return {"status": "success", "message": "Current location logged to history"}
        except Exception as e:
            return {"status": "error", "message": str(e)}
    
    return {"status": "error", "message": "Could not get current location"}
