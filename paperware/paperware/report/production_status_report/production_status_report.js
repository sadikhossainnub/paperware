frappe.query_reports["Production Status Report"] = {
    "filters": [
        {
            "fieldname": "status",
            "label": __("Status"),
            "fieldtype": "Select",
            "options": "\nPending\nIn Progress\nQuality Check\nCompleted"
        },
        {
            "fieldname": "sales_order",
            "label": __("Sales Order"),
            "fieldtype": "Link",
            "options": "Sales Order"
        },
        {
            "fieldname": "machine",
            "label": __("Machine"),
            "fieldtype": "Data"
        }
    ]
};
