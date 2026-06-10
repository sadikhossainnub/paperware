import frappe
from frappe import _
from frappe.utils import nowdate, getdate, add_days

@frappe.whitelist()
def get_dashboard_data():
    today = nowdate()
    
    # KPI Stats
    total_employees = frappe.db.count("Employee", {"status": "Active"})
    
    attendance_today = frappe.db.get_all("Attendance", 
        filters={"attendance_date": today, "docstatus": 1},
        fields=["status", "late_entry"]
    )
    
    present_today = len([a for a in attendance_today if a.status in ["Present", "Work From Home", "Half Day"]])
    late_today = len([a for a in attendance_today if a.late_entry])
    on_leave = len([a for a in attendance_today if a.status == "On Leave"])
    absent_today = total_employees - present_today - on_leave
    
    # Recent Activity (Last 10 Check-ins)
    recent_activity = frappe.db.get_all("Attendance",
        filters={"attendance_date": today, "docstatus": 1},
        fields=["employee_name", "in_time", "status", "late_entry"],
        order_by="in_time desc",
        limit=10
    )
    
    # Live Locations (Latest location logs for each user today)
    live_locations = frappe.db.sql("""
        select 
            ull.user, ull.latitude, ull.longitude, ull.timestamp, ull.address,
            u.full_name, e.employee_name, e.name as employee_id
        from 
            `tabUser Location Log` ull
        join 
            `tabUser` u on u.name = ull.user
        left join
            `tabEmployee` e on e.user_id = u.name
        where 
            date(ull.timestamp) = %s
            and ull.name in (
                select max(name) from `tabUser Location Log` 
                where date(timestamp) = %s 
                group by user
            )
    """, (today, today), as_dict=True)
    
    # Weekly Attendance Trend
    weekly_trend = []
    for i in range(7):
        date = add_days(today, -i)
        count = frappe.db.count("Attendance", {"attendance_date": date, "status": "Present", "docstatus": 1})
        weekly_trend.append({
            "date": date,
            "count": count
        })
    weekly_trend.reverse()

    # Apply Demo Data if real data is sparse
    if total_employees < 5:
        total_employees = 124
        present_today = 89
        late_today = 12
        on_leave = 5
        absent_today = 18
        
        recent_activity = [
            {"employee_name": "Javeria Khan", "in_time": "09:05:00", "status": "Present", "late_entry": 1},
            {"employee_name": "Ariful Islam", "in_time": "08:55:00", "status": "Present", "late_entry": 0},
            {"employee_name": "Sumaiya Akter", "in_time": "08:45:00", "status": "Present", "late_entry": 0},
            {"employee_name": "Rahat Ahmed", "in_time": "08:30:00", "status": "Present", "late_entry": 0},
            {"employee_name": "Mehzabin Chowdhury", "in_time": "10:15:00", "status": "Present", "late_entry": 1},
            {"employee_name": "Tanvir Hasan", "in_time": "08:50:00", "status": "Present", "late_entry": 0},
            {"employee_name": "Nusrat Jahan", "in_time": "09:10:00", "status": "Present", "late_entry": 1},
            {"employee_name": "Kamrul Islam", "in_time": "08:20:00", "status": "Present", "late_entry": 0},
        ]
        
        live_locations = [
            {"user": "demo1", "latitude": 23.8103, "longitude": 90.4125, "timestamp": "10 mins ago", "address": "Mirpur, Dhaka", "employee_name": "Rahat Ahmed"},
            {"user": "demo2", "latitude": 23.7509, "longitude": 90.3935, "timestamp": "5 mins ago", "address": "Dhanmondi, Dhaka", "employee_name": "Sumaiya Akter"},
            {"user": "demo3", "latitude": 23.8817, "longitude": 90.3994, "timestamp": "2 mins ago", "address": "Uttara, Dhaka", "employee_name": "Ariful Islam"},
            {"user": "demo4", "latitude": 23.7925, "longitude": 90.4078, "timestamp": "12 mins ago", "address": "Gulshan, Dhaka", "employee_name": "Javeria Khan"}
        ]
        
        weekly_trend = [
            {"date": add_days(today, -6), "count": 105},
            {"date": add_days(today, -5), "count": 98},
            {"date": add_days(today, -4), "count": 112},
            {"date": add_days(today, -3), "count": 108},
            {"date": add_days(today, -2), "count": 115},
            {"date": add_days(today, -1), "count": 85},
            {"date": today, "count": 89},
        ]

    return {
        "kpis": {
            "total_employees": total_employees,
            "present_today": present_today,
            "absent_today": max(0, absent_today),
            "late_today": late_today,
            "on_leave": on_leave
        },
        "recent_activity": recent_activity,
        "live_locations": live_locations,
        "weekly_trend": weekly_trend,
        "is_demo": total_employees == 124 and "Rahat Ahmed" in [ra["employee_name"] for ra in recent_activity]
    }
