// Copyright (c) 2026, abu sayed and contributors
// For license information, please see license.txt

frappe.ui.form.on("Production Order", {
    setup(frm) {
        if (!frm.doc.company) {
            frm.set_value("company", frappe.defaults.get_user_default("Company"));
        }
    },
    refresh(frm) {
        // Button fieldtype does not support hidden toggle via set_df_property.
        // Use add_custom_button instead — only visible when form is not submitted/cancelled.
        if (frm.doc.docstatus === 0) {
            frm.add_custom_button(__('Get Sales Order'), function() {
                show_sales_order_dialog(frm);
            }, __('Actions'));
        }
    },
});

function show_sales_order_dialog(frm) {
    const dialog = new frappe.ui.Dialog({
        title: __('Select Sales Orders'),
        fields: [
            {
                fieldname: 'sales_orders',
                fieldtype: 'Table',
                label: __('Sales Orders'),
                cannot_add_rows: false,
                cannot_delete_rows: false,
                in_place_edit: true,
                data: [{}],
                get_data: () => [],
                fields: [
                    {
                        fieldname: 'sales_order',
                        fieldtype: 'Link',
                        label: __('Sales Order'),
                        options: 'Sales Order',
                        in_list_view: 1,
                        reqd: 1,
                        get_query: () => ({
                            filters: { docstatus: 1 }
                        })
                    }
                ]
            }
        ],
        primary_action_label: __('Fetch Items'),
        primary_action(values) {
            const rows = values.sales_orders || [];
            const so_names = rows
                .map(r => r.sales_order)
                .filter(v => v);

            if (!so_names.length) {
                frappe.msgprint(__('Please add at least one Sales Order.'));
                return;
            }

            frappe.call({
                method: "paperware.production.doctype.production_order.production_order.get_items_from_sales_orders",
                args: { sales_orders: JSON.stringify(so_names) },
                callback(r) {
                    if (r.message) {
                        const { items, company } = r.message;

                        if (company) frm.set_value("company", company);

                        frm.clear_table("items");
                        (items || []).forEach(d => {
                            const row = frm.add_child("items");
                            row.item_code       = d.item_code;
                            row.item_name       = d.item_name;
                            row.description     = d.description;
                            row.sales_order     = d.sales_order;
                            row.customer        = d.customer;
                            row.customer_name   = d.customer_name;
                            row.sales_order_qty = d.sales_order_qty;
                            row.qty_to_produce  = d.qty_to_produce;
                            row.uom             = d.uom;
                            row.delivery_date   = d.delivery_date;
                            row.priority_level  = d.priority_level || "Medium";
                            row.item_status     = d.item_status    || "Draft";
                        });

                        frm.refresh_field("items");
                        dialog.hide();
                    }
                }
            });
        }
    });

    dialog.show();
}
