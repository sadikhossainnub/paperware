// Copyright (c) 2026, Sayed and contributors
// For license information, please see license.txt

const ITEM_TYPE_MAP = {
    cup_cone: ["Paper Cup", "Cup Holder", "Cup Jacket", "French Fry Cone"],
    box:      ["Meal Box", "Outer Box", "Tissue Box"],
    bag:      ["Paper Bag"],
    sheet:    ["Table Paper Matt", "Paper Leaflet", "Paper Sticker",
               "Business Card", "Hand Tag", "Memo Book", "Enevolve"],
    lid:      ["Plastic Lid"],
};

frappe.ui.form.on("Pre Costing Order", {
    item_type: function(frm) {
        toggle_dimension_sections(frm);
    },
    refresh: function(frm) {
        toggle_dimension_sections(frm);
        render_cost_summary(frm);
        if (frm.doc.docstatus === 1) {
            frm.add_custom_button(__("Generate Quotation"), () => {
                frm.call("make_quotation").then(r => {
                    if (r.message) frappe.set_route("Form", "Quotation", r.message);
                });
            }, __("Actions"));
            frm.add_custom_button(__("Generate BOM"), () => {
                frm.call("make_bom").then(r => {
                    if (r.message) frappe.msgprint(`BOM ${r.message} তৈরি হয়েছে।`);
                });
            }, __("Actions"));
        }
    },
    target_qty:          frm => frm.save(),
    ups_per_sheet:       frm => frm.save(),
    paper_rate_per_sheet: frm => frm.save(),
    profit_markup:       frm => frm.save(),
    printing_required:   frm => frm.save(),
    lamination_required: frm => frm.save(),
    die_cutting_required: frm => frm.save(),
});

function toggle_dimension_sections(frm) {
    const pt = frm.doc.item_type;
    const show = (sections, val) => sections.forEach(s => frm.toggle_display(s, val));

    show(["section_cup_dims"], ITEM_TYPE_MAP.cup_cone.includes(pt));
    show(["section_box_dims"], ITEM_TYPE_MAP.box.includes(pt));
    show(["section_bag_dims"], ITEM_TYPE_MAP.bag.includes(pt));
    show(["section_sheet_dims"], ITEM_TYPE_MAP.sheet.includes(pt));
    show(["section_lid_dims"], ITEM_TYPE_MAP.lid.includes(pt));
    show(["cup_wall_type", "double_wall_item"], pt === "Paper Cup");
    show(["foaming_required"], ["Paper Cup", "French Fry Cone"].includes(pt));
}

function render_cost_summary(frm) {
    if (!frm.doc.total_production_cost) {
        frm.fields_dict.cost_summary_html.html("");
        return;
    }
    const fmt = v => format_currency(v || 0);
    const row = (label, val, highlight) => `
        <tr style="${highlight ? 'background:#f0f9ff;font-weight:600' : ''}">
            <td style="padding:7px 10px;color:#374151">${label}</td>
            <td style="padding:7px 10px;text-align:right;color:${highlight ? '#1d4ed8' : '#111827'}">${val}</td>
        </tr>`;

    frm.fields_dict.cost_summary_html.html(`
        <div style="border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;margin-top:8px">
        <table style="width:100%;border-collapse:collapse;font-size:13px">
            ${row("কাগজ খরচ", fmt(frm.doc.total_paper_cost))}
            ${frm.doc.total_printing_cost ? row("Printing খরচ", fmt(frm.doc.total_printing_cost)) : ""}
            ${frm.doc.total_lamination_cost ? row("Lamination খরচ", fmt(frm.doc.total_lamination_cost)) : ""}
            ${frm.doc.total_die_cutting_cost ? row("Die Cutting খরচ", fmt(frm.doc.total_die_cutting_cost)) : ""}
            ${frm.doc.total_foaming_cost ? row("Foaming খরচ", fmt(frm.doc.total_foaming_cost)) : ""}
            ${frm.doc.total_additional_charges ? row("অন্যান্য চার্জ", fmt(frm.doc.total_additional_charges)) : ""}
            ${row("মোট উৎপাদন খরচ", fmt(frm.doc.total_production_cost), true)}
            ${row("খরচ/পিস", fmt(frm.doc.cost_per_unit))}
            ${row("বিক্রয় মূল্য (" + (frm.doc.profit_markup || 25) + "% markup)", fmt(frm.doc.selling_rate), true)}
            ${frm.doc.customer_target_price ? row("Customer Target", fmt(frm.doc.customer_target_price)) : ""}
        </table>
        </div>
    `);
}
