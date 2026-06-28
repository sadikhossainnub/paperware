frappe.ui.form.on("Sales Order", {
    refresh: function(frm) {
        if (frm.doc.docstatus === 1) {
            frm.add_custom_button(__("Production Order"), function() {
                frappe.model.open_mapped_doc({
                    method: "paperware.production.doctype.production_order.production_order.make_production_order",
                    frm: frm
                });
            }, __("Create"));
        }
    }
});
