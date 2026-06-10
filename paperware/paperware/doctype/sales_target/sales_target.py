import frappe
from frappe.model.document import Document

class SalesTarget(Document):
	def validate(self):
		self.calculate_totals()

	def calculate_totals(self):
		total_amount = 0
		total_qty = 0
		for item in self.targets:
			total_amount += item.target_amount or 0
			total_qty += item.target_qty or 0
		
		self.total_target_amount = total_amount
		self.total_target_qty = total_qty

@frappe.whitelist()
def get_dashboard_data(fiscal_year, period):
	# Fetch targets
	targets = frappe.get_all("Sales Target", 
		filters={"fiscal_year": fiscal_year, "target_period": period, "docstatus": 1},
		fields=["name", "sales_person", "total_target_amount", "total_target_qty"]
	)

	# Fetch actuals (Assuming Sales Invoice for now)
	# In a real scenario, we might need more complex logic for 'actuals'
	# such as filtering by date/month
	
	table_data = []
	total_target = 0
	total_actual = 0
	
	for target in targets:
		# Calculate actual for this sales person in the fiscal year
		# This is a simplified calculation
		actual_amount = frappe.db.get_value("Sales Invoice", 
			{"sales_person": target.sales_person, "docstatus": 1}, 
			"sum(base_grand_total)") or 0
		
		total_target += target.total_target_amount
		total_actual += actual_amount
		
		pct = round((actual_amount / target.total_target_amount * 100), 2) if target.total_target_amount else 0
		
		table_data.append({
			"sales_person": target.sales_person,
			"target_amount": target.total_target_amount,
			"actual_amount": actual_amount,
			"variance": actual_amount - target.total_target_amount,
			"pct": pct
		})

	stats = {
		"total_target": total_target,
		"total_actual": total_actual,
		"gap": total_target - total_actual,
		"achievement_pct": round((total_actual / total_target * 100), 2) if total_target else 0
	}

	# Dummy chart data for illustration if no real data
	charts = {
		"labels": [t["sales_person"] for t in table_data],
		"targets": [t["target_amount"] for t in table_data],
		"actuals": [t["actual_amount"] for t in table_data]
	}

	top_performers = sorted(table_data, key=lambda x: x["pct"], reverse=True)[:5]

	return {
		"stats": stats,
		"charts": charts,
		"top_performers": top_performers,
		"table_data": table_data
	}
