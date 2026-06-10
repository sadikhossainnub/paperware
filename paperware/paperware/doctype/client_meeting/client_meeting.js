// Copyright (c) 2026, Sayed and contributors
// For license information, please see license.txt

frappe.ui.form.on("Client Meeting", {
    refresh(frm) {
        // Filter contact by client
        frm.set_query("contact", function () {
            if (frm.doc.client) {
                return {
                    filters: {
                        links: ["like", "%Customer:" + frm.doc.client + "%"]
                    }
                };
            }
            return {};
        });

        // Add custom buttons for meeting state
        if (!frm.is_new()) {
            if (frm.doc.status === "Scheduled") {
                frm.add_custom_button(__('Start Meeting'), () => {
                    frm.set_value("status", "In Progress");
                    frm.save();
                }).addClass("btn-primary");
            } else if (frm.doc.status === "In Progress") {
                frm.add_custom_button(__('End Meeting'), () => {
                    frm.set_value("status", "Completed");
                    frm.save();
                }).addClass("btn-success");
            }
        }
    },
    client(frm) {
        // Reset contact if client changes
        frm.set_value("contact", "");
    }
});
