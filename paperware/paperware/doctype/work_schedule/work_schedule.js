// Copyright (c) 2026, abu sayed and contributors
// For license information, please see license.txt

frappe.ui.form.on("Work Schedule", {
    setup(frm) {
        frm.set_value("company", frappe.defaults.get_user_default("Company"));
    }
});
