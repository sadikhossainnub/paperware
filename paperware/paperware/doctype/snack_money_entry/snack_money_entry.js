// Copyright (c) 2026, abu sayed and contributors
// For license information, please see license.txt

frappe.ui.form.on("Snack Money Entry", {
    setup(frm) {
        frm.set_value("company", frappe.defaults.get_user_default("Company"));
    }
});

frappe.ui.form.on("Snack Money Entry Item", {
    amount(frm) {
        calculate_total(frm);
    },
    items_remove(frm) {
        calculate_total(frm);
    }
});

function calculate_total(frm) {
    let total = 0;
    (frm.doc.items || []).forEach(item => {
        total += item.amount || 0;
    });
    frm.set_value("total_amount", total);
}
