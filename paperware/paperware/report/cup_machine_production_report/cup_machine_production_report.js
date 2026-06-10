// Copyright (c) 2026, abu sayed and contributors
// For license information, please see license.txt

frappe.query_reports["Cup Machine Production Report"] = {
    filters: [
        {
            fieldname: "from_date",
            label: __("From Date"),
            fieldtype: "Date",
            default: frappe.datetime.month_start(),
            reqd: 1
        },
        {
            fieldname: "to_date",
            label: __("To Date"),
            fieldtype: "Date",
            default: frappe.datetime.month_end(),
            reqd: 1
        },
        {
            fieldname: "shift",
            label: __("Shift"),
            fieldtype: "Select",
            options: "\nMorning\nEvening\nNight"
        },
        {
            fieldname: "machine_name",
            label: __("Machine Name"),
            fieldtype: "Link",
            options: "Asset"
        },
        {
            fieldname: "customer",
            label: __("Customer"),
            fieldtype: "Link",
            options: "Customer"
        }
    ]
};
