// Copyright (c) 2026, Sayed and contributors
// For license information, please see license.txt

// ─── Utility ──────────────────────────────────────────────────────────────────

function calc_row_amount(row) {
    return (flt(row.rate) || 0) * (flt(row.multiplier) || 1);
}

function recalculate(frm) {
    let total_amount = 0;
    (frm.doc.items || []).forEach(row => {
        let amt = calc_row_amount(row);
        frappe.model.set_value(row.doctype, row.name, "amount", amt);
        total_amount += amt;
    });

    let qty = cint(frm.doc.qty) || 0;
    let pcs_per_sheet = cint(frm.doc.pcs_per_sheet) || 0;
    let margin_percent = flt(frm.doc.margin_percent) || 0;

    let production_rate = qty > 0 ? flt((total_amount / qty).toFixed(2)) : 0;
    let margin_amount   = flt((production_rate * margin_percent / 100).toFixed(2));
    let final_rate      = flt((production_rate + margin_amount).toFixed(2));
    let total_sheets    = (pcs_per_sheet > 0) ? Math.ceil(qty / pcs_per_sheet) : 0;

    frm.set_value("total_amount",    total_amount);
    frm.set_value("production_rate", production_rate);
    frm.set_value("margin_amount",   margin_amount);
    frm.set_value("final_rate",      final_rate);
    frm.set_value("total_sheets",    total_sheets);
}

// ─── Parent form events ───────────────────────────────────────────────────────

frappe.ui.form.on("Box Costing", {

    refresh: function(frm) {
        frm.add_custom_button(__("Create Quotation"), function() {
            frappe.confirm(
                __("Create a new Quotation for <b>{0}</b> at rate <b>৳{1}</b>?", [
                    frm.doc.item_code,
                    format_currency(frm.doc.final_rate)
                ]),
                function() {
                    frm.call({
                        method: "make_quotation",
                        doc: frm.doc,
                        freeze: true,
                        freeze_message: __("Creating Quotation…"),
                        callback: function(r) {
                            if (r.message) {
                                frappe.show_alert({
                                    message: __("Quotation {0} created", [r.message]),
                                    indicator: "green"
                                });
                                frappe.set_route("Form", "Quotation", r.message);
                            }
                        }
                    });
                }
            );
        }, __("Actions"));
    },

    // Fetch item_name and stock_uom when item_code changes
    item_code: function(frm) {
        if (frm.doc.item_code) {
            frappe.db.get_value("Item", frm.doc.item_code, ["item_name", "stock_uom"],
                function(value) {
                    if (value) {
                        frm.set_value("item_name", value.item_name || "");
                        if (value.stock_uom) {
                            frm.set_value("uom", value.stock_uom);
                        }
                    }
                }
            );
        } else {
            frm.set_value("item_name", "");
        }
    },

    qty:           function(frm) { recalculate(frm); },
    pcs_per_sheet: function(frm) { recalculate(frm); },
    margin_percent: function(frm) { recalculate(frm); },
});

// ─── Child table events ───────────────────────────────────────────────────────

frappe.ui.form.on("Box Costing Item", {
    rate:       function(frm) { recalculate(frm); },
    multiplier: function(frm) { recalculate(frm); },

    items_add:    function(frm, cdt, cdn) {
        // Default multiplier to 1 for new rows
        frappe.model.set_value(cdt, cdn, "multiplier", 1);
    },
    items_remove: function(frm) { recalculate(frm); },
});
