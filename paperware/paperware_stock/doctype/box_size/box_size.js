// Copyright (c) 2025, Frappe Technologies Pvt. Ltd. and contributors
// For license information, please see license.txt

frappe.ui.form.on("Box Size", {
    refresh(frm) {

    },
    length: function (frm) {
        frm.trigger('autogenerate_name');
    },
    height: function (frm) {
        frm.trigger('autogenerate_name');
    },
    weight: function (frm) {
        frm.trigger('autogenerate_name');
    },
    autogenerate_name: function (frm) {
        if (frm.doc.length && frm.doc.height && frm.doc.weight) {
            let name_val = `H${frm.doc.height}XW${frm.doc.weight}XL${frm.doc.length}`;
            frm.set_value('name', name_val);
        }
    }
});
