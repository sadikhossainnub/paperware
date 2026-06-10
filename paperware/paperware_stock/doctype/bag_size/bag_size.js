// Copyright (c) 2025, Frappe Technologies Pvt. Ltd. and contributors
// For license information, please see license.txt

frappe.ui.form.on("Bag Size", {
    height(frm) {
        set_name(frm);
    },
    weight(frm) {
        set_name(frm);
    },
    length(frm) {
        set_name(frm);
    }
});

function set_name(frm) {
    if (frm.doc.height || frm.doc.weight || frm.doc.length) {
        let name_str = `H${frm.doc.height || 0}XW${frm.doc.weight || 0}XL${frm.doc.length || 0}`;
        frm.set_value("name", name_str);
    }
}
