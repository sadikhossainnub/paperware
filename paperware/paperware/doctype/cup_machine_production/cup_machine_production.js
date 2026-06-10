// Copyright (c) 2026, abu sayed and contributors
// For license information, please see license.txt

frappe.ui.form.on("Cup Machine Production", {
    setup(frm) {
        frm.set_value("company", frappe.defaults.get_user_default("Company"));
    }
});

frappe.ui.form.on("Cup Machine Production Item", {
    quantity_produced(frm, cdt, cdn) {
        calculate_net(frm, cdt, cdn);
        calculate_grand_totals(frm);
    },
    wastage(frm, cdt, cdn) {
        calculate_net(frm, cdt, cdn);
        calculate_grand_totals(frm);
    },
    items_remove(frm) {
        calculate_grand_totals(frm);
    }
});

function calculate_net(frm, cdt, cdn) {
    let row = locals[cdt][cdn];
    let net = (row.quantity_produced || 0) - (row.wastage || 0);
    frappe.model.set_value(cdt, cdn, "net_production", net);
}

function calculate_grand_totals(frm) {
    let total_production = 0;
    let total_wastage = 0;
    (frm.doc.items || []).forEach(item => {
        total_production += item.quantity_produced || 0;
        total_wastage += item.wastage || 0;
    });
    frm.set_value("grand_total_production", total_production);
    frm.set_value("grand_total_wastage", total_wastage);
}
