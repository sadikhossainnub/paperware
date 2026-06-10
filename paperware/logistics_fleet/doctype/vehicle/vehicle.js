// Copyright (c) 2026, abu sayed and contributors
// For license information, please see license.txt

frappe.ui.form.on("Vehicle", {
    refresh(frm) {
        if (frm.doc.gps_device_id) {
            frm.add_custom_button(__('Sync Live GPS'), () => {
                frm.trigger('sync_gps');
            }).addClass('btn-primary');

            frm.trigger('render_tracking_map');

            // Add View Travel History button
            frm.add_custom_button(__('View Travel History'), () => {
                frappe.set_route('vehicle-travel-history', { vehicle: frm.doc.name });
            }, __('GPS Actions'));

            // Start Live Feed if not already started
            if (!frm.live_feed_interval) {
                frm.live_feed_interval = setInterval(() => {
                    if (frm.doc.gps_device_id && !frm.is_dirty() && cur_frm && cur_frm.doc.name === frm.doc.name) {
                        frm.trigger('sync_gps_silent');
                    }
                }, 10000); // Sync every 10 seconds
            }
        }

        frm.add_custom_button(__('Find Device ID'), () => {
            frm.trigger('find_device_id');
        }, __('GPS Actions'));
    },

    on_unload(frm) {
        if (frm.live_feed_interval) {
            clearInterval(frm.live_feed_interval);
            frm.live_feed_interval = null;
        }
    },

    sync_gps(frm) {
        frappe.call({
            doc: frm.doc,
            method: 'sync_gps',
            freeze: true,
            callback: function (r) {
                if (!r.exc) {
                    frappe.show_alert({ message: __('GPS Data Synced'), indicator: 'green' });
                    frm.trigger('update_map_fields', r.message);
                }
            }
        });
    },

    sync_gps_silent(frm) {
        frappe.call({
            doc: frm.doc,
            method: 'sync_gps',
            callback: function (r) {
                if (!r.exc && r.message) {
                    frm.trigger('update_map_fields', r.message);
                }
            }
        });
    },

    update_map_fields(frm, data) {
        // Refresh fields and re-render map
        frm.refresh_field('last_latitude');
        frm.refresh_field('last_longitude');
        frm.refresh_field('last_speed');
        frm.refresh_field('last_sync');
        frm.refresh_field('status');
        frm.trigger('render_tracking_map');
    },

    find_device_id(frm) {
        frappe.call({
            method: 'paperware.logistics_fleet.doctype.vehicle.vehicle.get_all_devices',
            callback: function (r) {
                if (r.message && r.message.length > 0) {
                    let d = new frappe.ui.Dialog({
                        title: __('Select Autonemo Device'),
                        fields: [
                            {
                                label: __('Device'),
                                fieldname: 'device',
                                fieldtype: 'Select',
                                options: r.message.map(i => ({ label: `${i.name} (ID: ${i.id})`, value: i.id })),
                                reqd: 1
                            }
                        ],
                        primary_action_label: __('Use Selected ID'),
                        primary_action(values) {
                            frm.set_value('gps_device_id', values.device);
                            d.hide();
                        }
                    });
                    d.show();
                }
            }
        });
    },

    render_tracking_map(frm) {
        if (!frm.doc.last_latitude || !frm.doc.last_longitude) {
            frm.set_df_property('tracking_map_html', 'options', '<div class="alert alert-warning">No GPS data found. Click "Sync Live GPS".</div>');
            return;
        }

        const lat = frm.doc.last_latitude;
        const lng = frm.doc.last_longitude;
        const speed = frm.doc.last_speed || '0 km/h';
        const updated = frm.doc.last_sync ? frappe.datetime.str_to_user(frm.doc.last_sync) : 'Never';

        // Advanced Embedded Map Template
        const html = `
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
                <div style="height: 450px; position: relative;">
                    <iframe 
                        width="100%" 
                        height="100%" 
                        frameborder="0" 
                        src="https://maps.google.com/maps?q=${lat},${lng}&z=16&output=embed"
                        style="border:0;"
                    ></iframe>
                </div>
                <div style="padding: 15px; display: flex; justify-content: space-between; align-items: center; background: white; border-top: 1px solid #f1f5f9;">
                    <div>
                        <div style="font-size: 14px; font-weight: 700; color: #0f172a;">📍 ${frm.doc.vehicle_number}</div>
                        <div style="font-size: 11px; color: #64748b;">Last Updated: ${updated}</div>
                    </div>
                    <div style="text-align: right;">
                        <span style="display: inline-block; padding: 4px 12px; border-radius: 20px; background: #f0fdf4; color: #16a34a; font-weight: 800; font-size: 12px; border: 1px solid #dcfce7;">
                            LIVE • ${speed}
                        </span>
                        <div style="margin-top: 5px;">
                            <a href="https://www.google.com/maps?q=${lat},${lng}" target="_blank" style="font-size: 11px; color: #2563eb; text-decoration: none; font-weight: 600;">
                                View in Google Maps →
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        `;

        frm.set_df_property('tracking_map_html', 'options', null); // Clear first
        frm.set_df_property('tracking_map_html', 'options', html);
    }
});
