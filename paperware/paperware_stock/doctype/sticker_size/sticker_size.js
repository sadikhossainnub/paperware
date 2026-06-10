// Copyright (c) 2025, Frappe Technologies Pvt. Ltd. and contributors
// For license information, please see license.txt

frappe.ui.form.on("Sticker Size", {
    length(frm) {
        set_name(frm);
    },
    weight(frm) {
        set_name(frm);
    },
    shape(frm) {
        set_name(frm);
    }
});

function set_name(frm) {
    if (frm.doc.length || frm.doc.weight || frm.doc.shape) {
        let name_str = `${frm.doc.shape || 0}-L${frm.doc.length || 0}XW${frm.doc.weight || 0}`;
        frm.set_value("name", name_str);
    }
}
