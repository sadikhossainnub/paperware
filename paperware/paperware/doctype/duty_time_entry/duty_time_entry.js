// Copyright (c) 2026, abu sayed and contributors
// For license information, please see license.txt

frappe.ui.form.on("Duty Time Entry", {
    employee(frm) {
        if (frm.doc.employee) {
            frm.set_value("company", frappe.defaults.get_user_default("Company"));
        }
    },

    start_time(frm) {
        calculate_total_hours(frm);
    },

    end_time(frm) {
        calculate_total_hours(frm);
    }
});

function calculate_total_hours(frm) {
    if (frm.doc.start_time && frm.doc.end_time) {
        let start = moment(frm.doc.start_time, "HH:mm:ss");
        let end = moment(frm.doc.end_time, "HH:mm:ss");
        let diff = end.diff(start, "hours", true);
        if (diff < 0) diff += 24;
        frm.set_value("total_hours", Math.round(diff * 100) / 100);
    }
}
