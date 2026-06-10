frappe.pages['logistics-dashboard'].on_page_load = function (wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: __('Logistics Fleet Dashboard'),
        single_column: true
    });

    frappe.logistics_dashboard.init(page);
}

frappe.logistics_dashboard = {
    init: function (page) {
        this.page = page;
        this.render();
    },

    render: function () {
        const $container = $(`<div class="logistics-dashboard">`).appendTo(this.page.main);

        this.load_metrics($container);
        this.load_fleet_map($container);
        this.load_active_deliveries($container);

        this.page.set_primary_action(__('Refresh'), () => {
            this.page.main.empty();
            this.render();
        });
    },

    load_metrics: function ($container) {
        const $metrics_wrapper = $('<div class="dashboard-section stats-grid">').appendTo($container);

        frappe.call({
            method: "paperware.paperware.ai_api.logistics.get_logistics_metrics",
            callback: (r) => {
                const data = r.message || {};

                $metrics_wrapper.html(`
                    <div class="stat-card">
                        <div class="stat-val">${data.total_fleet || 0}</div>
                        <div class="stat-lbl">Total Fleet</div>
                    </div>
                    <div class="stat-card success">
                        <div class="stat-val">${data.online_vehicles || 0}</div>
                        <div class="stat-lbl">Vehicles Online</div>
                    </div>
                    <div class="stat-card info">
                        <div class="stat-val">${data.active_deliveries || 0}</div>
                        <div class="stat-lbl">Active Deliveries</div>
                    </div>
                    <div class="stat-card warning">
                        <div class="stat-val">${data.alerts || 0}</div>
                        <div class="stat-lbl">Alerts</div>
                    </div>
                `);
            }
        });
    },

    load_fleet_map: function ($container) {
        const $map_section = $(`
            <div class="dashboard-section">
                <div class="section-title">
                    <i class="fa fa-map-marker"></i> ${__('Fleet Live View')}
                </div>
                <div class="fleet-map-wrapper">
                    <div id="fleet-map" class="map-container">
                        <div class="text-center p-5 text-muted">${__('Loading Map Data...')}</div>
                    </div>
                </div>
            </div>
        `).appendTo($container);

        frappe.call({
            method: "frappe.client.get_list",
            args: {
                doctype: "Vehicle",
                fields: ["name", "vehicle_number", "last_latitude", "last_longitude", "last_speed", "status", "last_sync"],
                filters: { last_latitude: ["!=", 0], last_latitude: ["is", "set"] }
            },
            callback: (r) => {
                if (r.message && r.message.length > 0) {
                    this.init_map(r.message);
                } else {
                    $('#fleet-map').html('<div class="text-center p-5 text-muted">No vehicles with live GPS found.</div>');
                }
            }
        });
    },

    init_map: function (vehicles) {
        const center_lat = vehicles[0].last_latitude || 23.8103;
        const center_lng = vehicles[0].last_longitude || 90.4125;

        const markers_js = vehicles.map(v => {
            if (!v.last_latitude || !v.last_longitude) return '';
            return `
                L.marker([${v.last_latitude}, ${v.last_longitude}])
                    .addTo(map)
                    .bindPopup("<b>${v.vehicle_number}</b><br>Speed: ${v.last_speed || '0 km/h'}<br>Status: ${v.status}");
            `;
        }).filter(m => m !== '').join('\n');

        const map_content = `
            <!DOCTYPE html>
            <html>
            <head>
                <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
                <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
                <style>body { margin: 0; } #map { height: 100vh; width: 100vw; }</style>
            </head>
            <body>
                <div id="map"></div>
                <script>
                    var map = L.map('map').setView([${center_lat}, ${center_lng}], 13);
                    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                        attribution: 'OSM'
                    }).addTo(map);
                    ${markers_js}
                    
                    if (${vehicles.length} > 1) {
                        var group = new L.featureGroup([
                            ${vehicles.map(v => `L.marker([${v.last_latitude}, ${v.last_longitude}])`).join(',')}
                        ]);
                        map.fitBounds(group.getBounds().pad(0.1));
                    }
                </script>
            </body>
            </html>
        `;

        const blob = new Blob([map_content], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        $('#fleet-map').html(`<iframe src="${url}" style="width:100%; height:100%; border:none;"></iframe>`);
    },

    load_active_deliveries: function ($container) {
        const $delivery_section = $(`
            <div class="dashboard-section mt-5">
                <div class="section-title">
                    <i class="fa fa-truck"></i> ${__('Active Deliveries')}
                </div>
                <div class="table-responsive fleet-map-wrapper p-3 bg-white">
                    <table class="table table-hover" id="deliveries-table">
                        <thead>
                            <tr>
                                <th>Delivery Note</th>
                                <th>Customer</th>
                                <th>Status</th>
                                <th>Amount</th>
                                <th>Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr><td colspan="5" class="text-center text-muted">Loading deliveries...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `).appendTo($container);

        frappe.call({
            method: "frappe.client.get_list",
            args: {
                doctype: "Delivery Note",
                filters: { status: ["!=", "Completed"] },
                fields: ["name", "customer", "status", "grand_total", "posting_date"],
                limit: 10
            },
            callback: (r) => {
                const $tbody = $('#deliveries-table tbody');
                $tbody.empty();
                if (r.message && r.message.length) {
                    r.message.forEach(d => {
                        const statusClass = d.status === 'Draft' ? 'warning' : 'info';
                        const date = d.posting_date ? frappe.datetime.str_to_user(d.posting_date) : '-';
                        $tbody.append(`
                            <tr>
                                <td><a href="/app/delivery-note/${d.name}" class="text-primary font-weight-bold">${d.name}</a></td>
                                <td>${d.customer || '-'}</td>
                                <td><span class="badge badge-${statusClass}">${d.status}</span></td>
                                <td>${format_currency(d.grand_total)}</td>
                                <td>${date}</td>
                            </tr>
                        `);
                    });
                } else {
                    $tbody.append('<tr><td colspan="5" class="text-center text-muted">No active deliveries found</td></tr>');
                }
            }
        });
    }
};
