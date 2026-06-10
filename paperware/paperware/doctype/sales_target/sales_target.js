frappe.ui.form.on('Sales Target', {
    refresh: function (frm) {
        // 
    },
    calculate_totals: function (frm) {
        let total_amount = 0;
        let total_qty = 0;
        (frm.doc.targets || []).forEach(item => {
            total_amount += item.target_amount || 0;
            total_qty += item.target_qty || 0;
        });
        frm.set_value('total_target_amount', total_amount);
        frm.set_value('total_target_qty', total_qty);
    }
});

frappe.ui.form.on('Sales Target Item', {
    target_amount: function (frm, cdt, cdn) {
        frm.trigger('calculate_totals');
    },
    target_qty: function (frm, cdt, cdn) {
        frm.trigger('calculate_totals');
    },
    targets_remove: function (frm, cdt, cdn) {
        frm.trigger('calculate_totals');
    }
});
