// Copyright (c) 2026, abu sayed and contributors
// For license information, please see license.txt

frappe.ui.form.on("Production Report", {
    setup(frm) {
        frm.set_value("company", frappe.defaults.get_user_default("Company"));
    }
});

frappe.ui.form.on("Production Report Item", {
    quantity_produced(frm) {
        calculate_totals(frm);
    },
    wastage(frm) {
        calculate_totals(frm);
    },
    items_remove(frm) {
        calculate_totals(frm);
    }
});

function calculate_totals(frm) {
    let total_production = 0;
    let total_wastage = 0;
    (frm.doc.items || []).forEach(item => {
        total_production += item.quantity_produced || 0;
        total_wastage += item.wastage || 0;
    });
    frm.set_value("total_production", total_production);
    frm.set_value("total_wastage", total_wastage);
}
