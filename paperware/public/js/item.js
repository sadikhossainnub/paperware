
frappe.ui.form.on('Item', {
    refresh: function (frm) {
        if (!frm.is_new()) {
            if (frm.fields_dict.description && frm.fields_dict.description.$input) {
                frm.fields_dict.description.$input.on("input", function () {
                    if (frm.doc.description) {
                        frm.set_value("description_manually_edited", 1);
                    }
                });
            }
        }
    },
    before_save: async function(frm) {
        if (!frm.doc) return;

        const parts = [
            "item_type",
            "paper_name",
            "paper_cup_size",
            "lid_color",
            "lid_type",
            "paper_cup_wall",
            "box_name",
            "bag_name",
            "envelop_name",
            "office_document_name",
            "file_folder_name",
            "brochure_name",
            "calendar_name",
            "window_size",
            "bag_size",
            "table_matt_size",
            "box_size",
            "sticker_size",
            "tray_size",
            "cone_size",
            "leaflet_size",
            "business_card_size",
            "wrapping_paper_size",
            "holder_size",
            "file_folder_size",
            "invoice_size",
            "envelop_size",
            "paper_gsm",
            "item_brand",
            "sub_brand",
            "origin"
        ];

        function clean_value(value) {
            return String(value)
                .trim()
                .replace(/[^a-zA-Z0-9\s]/g, "")   // remove special characters
                .replace(/\s+/g, "-")            // space to hyphen
                .toUpperCase();
        }

        let filtered_parts = parts
            .map(field => frm.doc[field])
            .filter(val => val && String(val).trim() !== "")
            .map(val => clean_value(val))
            .filter(val => val);

        let new_item_code = "";

        // Fallback if no fields filled
        if (filtered_parts.length === 0) {
            new_item_code = clean_value(frm.doc.item_name || "ITEM");
        } else {
            new_item_code = filtered_parts.join("-");
        }

        // Length safety (ERPNext limit safe)
        if (new_item_code.length > 140) {
            new_item_code = new_item_code.substring(0, 140);
        }

        // Duplicate protection
        if (new_item_code !== frm.doc.item_code) {
            let exists = await frappe.db.exists("Item", new_item_code);
            if (exists && exists !== frm.doc.name) {
                frappe.throw(`Item Code already exists: ${new_item_code}`);
            }

            await frm.set_value("item_code", new_item_code);
        }
    },
    validate: function(frm) {
        if (frm.doc.description_manually_edited) {
            return;
        }

        let fields = {
            "Box Name": frm.doc.box_name,
            "Bag Name": frm.doc.bag_name,
            "Cone Name": frm.doc.cone_name,
            "Envelop Name": frm.doc.envelop_name,
            "Office Document Name": frm.doc.office_document_name,
            "Paper Name": frm.doc.paper_name,
            "Paper GSM": frm.doc.paper_gsm,
            "Paper Cup Size": frm.doc.paper_cup_size,
            "Paper Cup Type": frm.doc.paper_cup_type,
            "Paper Cup Wall": frm.doc.paper_cup_wall,
            "Single Wall Paper GSM": frm.doc.single_wall_paper_gsm,
            "Double Wall Paper GSM": frm.doc.double_wall_paper_gsm,
            "Bottom GSM": frm.doc.bottom_gsm,
            "Printing Colour": frm.doc.printing_colour,
            "Lamination": frm.doc.lamination,
            "Foil": frm.doc.foil,
            "Origin": frm.doc.origin,
            "Lid Size": frm.doc.lid_size,
            "Lid Color": frm.doc.lid_color,
            "Lid Type": frm.doc.lid_type,
            "Quality": frm.doc.quality,
            "Printing Metallic": frm.doc.printing_metallic,
            "Printing Sandy": frm.doc.printing_sandy,
            "Corrugated": frm.doc.corrugated,
            "Pasting": frm.doc.pasting,
            "Lock": frm.doc.lock,
            "Holder Size": frm.doc.holder_size,
            "Ambush": frm.doc.ambush,
            "Box Size": frm.doc.box_size,
            "Window": frm.doc.window,
            "Window Size": frm.doc.window_size,
            "Ribbon": frm.doc.ribbon,
            "Bag Size": frm.doc.bag_size,
            "Table Matt Size": frm.doc.table_matt_size,
            "Die Cut": frm.doc.die_cut,
            "Tray Size": frm.doc.tray_size,
            "Wrapping Paper Size": frm.doc.wrapping_paper_size,
            "Sticker Size": frm.doc.sticker_size,
            "Cone Size": frm.doc.cone_size,
            "Leaflet Size": frm.doc.leaflet_size,
            "Page Fold": frm.doc.page_fold,
            "Business Card Size": frm.doc.business_card_size,
            "Hang Tag Size": frm.doc.hang_tag_size,
            "Eye Late": frm.doc.eye_late,
            "Envelop Size": frm.doc.envelop_size,
            "Invoice Size": frm.doc.invoice_size,
            "Punch Option": frm.doc.punch_option,
            "Page": frm.doc.page,
            "Brand": frm.doc.item_brand,
            "Sub Brand": frm.doc.sub_brand
        };

        let description = "";

        Object.keys(fields).forEach(label => {
            if (fields[label]) {
                description += `<b>${label}</b>: ${fields[label]}<br>`;
            }
        });

        if (Array.isArray(frm.doc.attributes)) {
            frm.doc.attributes.forEach(attr => {
                if (attr.attribute && attr.attribute_value) {
                    description += `<b>${attr.attribute}</b>: ${attr.attribute_value}<br>`;
                }
            });
        }

        frm.set_value("description", description.trim());
    }
});
