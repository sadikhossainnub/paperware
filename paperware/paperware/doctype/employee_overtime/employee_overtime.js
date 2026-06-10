// Copyright (c) 2026, Sadik Hossain and contributors
// For license information, please see license.txt

frappe.ui.form.on('Employee Overtime', {
    onload: function (frm) {
        if (frm.is_new()) {
            if (!frm.doc.company) {
                frm.set_value('company', frappe.defaults.get_user_default('Company'));
            }
            if (frm.doc.company && !frm.doc.payment_account) {
                set_default_cash_account(frm);
            }
            if (!frm.doc.expense_account) {
                set_default_expense_account(frm);
            }
        }
    },

    employee: function (frm) {
        fetch_shift_and_attendance(frm);
    },

    date: function (frm) {
        fetch_shift_and_attendance(frm);
    },

    company: function (frm) {
        if (frm.doc.company) {
            set_default_cash_account(frm);
        }
    },

    setup: function (frm) {

        // Filter payment account: Cash/Bank (Asset) accounts for the selected company
        frm.set_query('payment_account', function () {
            return {
                filters: {
                    company: frm.doc.company,
                    root_type: 'Asset',
                    is_group: 0,
                    account_type: ['in', ['Cash', 'Bank']]
                }
            };
        });
    },

    start_time: function (frm) {
        calculate_amounts(frm);
    },

    end_time: function (frm) {
        calculate_amounts(frm);
    },

    overtime_rate: function (frm) {
        calculate_amounts(frm);
    },

    overtime_allowance: function (frm) {
        calculate_amounts(frm);
    }
});

function calculate_amounts(frm) {
    let hours = 0;
    if (frm.doc.start_time && frm.doc.end_time) {
        let t1 = time_to_hours(frm.doc.start_time);
        let t2 = time_to_hours(frm.doc.end_time);
        if (t2 < t1) {
            hours = (24 - t1) + t2; // Crosses midnight
        } else {
            hours = t2 - t1;
        }
    }

    // Round to 2 decimal places to avoid visual bugs
    hours = flt(hours, 2);

    frm.set_value('overtime_hours', hours);
    let overtime_amount = hours * flt(frm.doc.overtime_rate);
    frm.set_value('overtime_amount', overtime_amount);
    frm.set_value('total_amount', overtime_amount + flt(frm.doc.overtime_allowance));
}

function time_to_hours(time_str) {
    // Convert "HH:MM:SS" or "HH:MM" to decimal hours
    if (!time_str) return 0;
    let parts = time_str.split(':');
    let hours = parseInt(parts[0]) || 0;
    let minutes = parseInt(parts[1]) || 0;
    let seconds = parseInt(parts[2]) || 0;
    return hours + (minutes / 60) + (seconds / 3600);
}

function set_default_cash_account(frm) {
    frappe.call({
        method: 'frappe.client.get_value',
        args: {
            doctype: 'Account',
            filters: {
                company: frm.doc.company,
                account_type: 'Cash',
                is_group: 0
            },
            fieldname: 'name'
        },
        callback: function (r) {
            if (r.message && r.message.name) {
                frm.set_value('payment_account', r.message.name);
            }
        }
    });
}

function set_default_expense_account(frm) {
    frappe.call({
        method: 'frappe.client.get_value',
        args: {
            doctype: 'Overtime Settings',
            fieldname: 'default_expense_account'
        },
        callback: function (r) {
            if (r.message && r.message.default_expense_account) {
                frm.set_value('expense_account', r.message.default_expense_account);
            }
        }
    });
}

function fetch_shift_and_attendance(frm) {
    if (frm.doc.employee && frm.doc.date) {
        frappe.call({
            method: 'paperware.paperware.doctype.employee_overtime.employee_overtime.get_shift_and_attendance',
            args: {
                employee: frm.doc.employee,
                date: frm.doc.date
            },
            callback: function (r) {
                if (r.message) {
                    frappe.model.set_value(frm.doctype, frm.docname, {
                        'shift': r.message.shift,
                        'shift_start_time': r.message.shift_start_time,
                        'shift_end_time': r.message.shift_end_time,
                        'actual_check_in': r.message.actual_check_in,
                        'actual_check_out': r.message.actual_check_out
                    });
                }
            }
        });
    }
}
