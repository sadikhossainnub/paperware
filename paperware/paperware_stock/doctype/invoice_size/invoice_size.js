// Copyright (c) 2025, Frappe Technologies Pvt. Ltd. and contributors
// For license information, please see license.txt

frappe.ui.form.on("Invoice Size", {
    length(frm) {
        set_name(frm);
    },
    width(frm) {
        set_name(frm);
    }
});

function set_name(frm) {
    if (frm.doc.length || frm.doc.width) {
        // Using L and W as Height is not in this DocType
        let name_str = `L${frm.doc.length || 0}XW${frm.doc.width || 0}`;
        frm.set_value("name", name_str);
    }
}
