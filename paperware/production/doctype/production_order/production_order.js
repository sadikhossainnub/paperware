// Copyright (c) 2026, abu sayed and contributors
// For license information, please see license.txt

frappe.ui.form.on("Production Order", {
    setup(frm) {
        if (!frm.doc.company) {
            frm.set_value("company", frappe.defaults.get_user_default("Company"));
        }
    },
    refresh(frm) {
        if (frm.doc.sales_order) {
            frm.set_df_property("get_sales_order", "hidden", 1);
        } else {
            frm.set_df_property("get_sales_order", "hidden", 0);
        }
    },
    get_sales_order(frm) {
        frappe.prompt([
            {
                fieldtype: 'Link',
                fieldname: 'sales_order',
                label: __('Sales Order'),
                options: 'Sales Order',
                reqd: 1,
                get_query: function() {
                    return {
                        filters: {
                            docstatus: 1
                        }
                    };
                }
            }
        ], function(values) {
            frappe.call({
                method: "paperware.production.doctype.production_order.production_order.make_production_order",
                args: {
                    source_name: values.sales_order
                },
                callback: function(r) {
                    if (r.message) {
                        var source_doc = r.message;
                        frm.set_value("sales_order", source_doc.sales_order);
                        frm.set_value("company", source_doc.company);
                        frm.set_value("customer_name", source_doc.customer_name);
                        
                        frm.clear_table("items");
                        $.each(source_doc.items, function(i, d) {
                            var item = frm.add_child("items");
                            item.item_code = d.item_code;
                            item.item_name = d.item_name;
                            item.description = d.description;
                            item.sales_order = d.sales_order;
                            item.customer = d.customer;
                            item.customer_name = d.customer_name;
                            item.sales_order_qty = d.sales_order_qty;
                            item.qty_to_produce = d.qty_to_produce;
                            item.produced_qty = d.produced_qty;
                            item.uom = d.uom;
                            item.delivery_date = d.delivery_date;
                            item.planned_date = d.planned_date;
                            item.priority_level = d.priority_level;
                            item.item_status = d.item_status;
                            item.production_specification = d.production_specification;
                        });
                        frm.refresh_field("items");
                        frm.set_df_property("get_sales_order", "hidden", 1);
                    }
                }
            });
        }, __('Select Sales Order'), __('Get Details'));
    }
});
