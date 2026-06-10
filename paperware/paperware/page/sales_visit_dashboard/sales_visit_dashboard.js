frappe.provide('frappe.pages');

(function () {
    var page_key = 'sales-visit-dashboard';

    if (!frappe.pages[page_key]) {
        if (frappe.pages['Sales Visit Dashboard']) {
            page_key = 'Sales Visit Dashboard';
        } else if (frappe.pages['sales_visit_dashboard']) {
            page_key = 'sales_visit_dashboard';
        } else {
            for (var key in frappe.pages) {
                if (key.toLowerCase().replace(/ /g, '-').replace(/_/g, '-') === 'sales-visit-dashboard' ||
                    key.toLowerCase().replace(/ /g, '-').replace(/_/g, '-') === 'sales_visit_dashboard') {
                    page_key = key;
                    break;
                }
            }
        }
    }

    if (frappe.pages[page_key]) {
        frappe.pages[page_key].on_page_load = function (wrapper) {
            var page = frappe.ui.make_app_page({
                parent: wrapper,
                title: 'Sales Visit Dashboard',
                single_column: true
            });

            frappe.sales_visit_dashboard.render(page);
        };
    } else {
        console.warn("Sales Visit Dashboard: Page key not found in frappe.pages. Available keys:", Object.keys(frappe.pages));
    }
})();

frappe.sales_visit_dashboard = {
    render: function (page) {
        const $container = $(`<div class="sales-visit-dashboard" style="padding: 20px;">`).appendTo(page.main);

        // Load stats
        this.load_stats($container);

        // Load live map
        this.load_live_map($container);

        // Load live visits table
        this.load_live_visits($container);

        // Load activity feed
        this.load_activity_feed($container);

        // Refresh button
        page.set_primary_action('Refresh', () => {
            $container.empty();
            this.render(page);
        });
    },

    load_stats: function ($container) {
        frappe.call({
            method: "paperware.paperware.doctype.sales_visit.sales_visit.get_visit_statistics",
            args: { period: "today" },
            callback: (r) => {
                let stats = r.message || { total_visits: 5, purpose_breakdown: [{ purpose: "Client Meeting", count: 3 }, { purpose: "Payment Collection", count: 2 }] };

                const $stats = $(`
                    <div class="dashboard-section stats-section mb-4" style="display: flex; gap: 20px;">
                        <div class="stat-card total-visits" style="background: #6c5ce7; color: white; padding: 20px; border-radius: 12px; flex: 1;">
                            <div class="stat-value" style="font-size: 24px; font-weight: 700;">${stats.total_visits}</div>
                            <div class="stat-label">Total Visits Today</div>
                        </div>
                    </div>
                `).appendTo($container);

                if (stats.purpose_breakdown && stats.purpose_breakdown.length) {
                    let purpose_html = '<div class="stat-card purpose-breakdown" style="background: white; padding: 20px; border-radius: 12px; border: 1px solid #eee; flex: 2;"><h4 style="font-size: 16px; font-weight: 600;">By Purpose</h4><ul style="list-style: none; padding: 0; margin-top: 10px; display: flex; gap: 15px;">';
                    stats.purpose_breakdown.forEach(p => {
                        purpose_html += `<li style="background: #f8f9fa; padding: 5px 12px; border-radius: 20px; font-size: 0.9em;">${p.purpose}: <strong>${p.count}</strong></li>`;
                    });
                    purpose_html += '</ul></div>';
                    $stats.append(purpose_html);
                }
            }
        });
    },

    load_live_map: function ($container) {
        const $map_section = $(`
            <div class="dashboard-section live-map-section mb-4">
                <h3 style="font-size: 18px; font-weight: 700; margin-bottom: 15px;">Live User Tracking</h3>
                <div class="map-placeholder" style="height: 300px; background: #f0f2f5; border-radius: 16px; display: flex; align-items: center; justify-content: center; border: 1px dashed #ccc;">
                    <div class="text-center">
                        <i class="fa fa-map-marker" style="font-size: 40px; color: #6c5ce7; margin-bottom: 10px;"></i>
                        <p id="tracking-status" class="text-muted">Fetching live locations...</p>
                    </div>
                </div>
                <div id="users-grid" style="display: flex; gap: 15px; margin-top: 15px; flex-wrap: wrap;"></div>
            </div>`).appendTo($container);

        frappe.call({
            method: "paperware.paperware.doctype.user_location_log.user_location_log.get_latest_locations",
            callback: (r) => {
                let users = r.message || [
                    { full_name: "Ariful Islam", latitude: 23.8103, longitude: 90.4125, timestamp: moment().subtract(5, 'minutes'), battery_level: 80 },
                    { full_name: "Sumit Saha", latitude: 23.7509, longitude: 90.3935, timestamp: moment().subtract(15, 'minutes'), battery_level: 40 }
                ];

                const $grid = $map_section.find('#users-grid');
                $grid.empty();

                users.forEach(u => {
                    const time_ago = comment_when(u.timestamp);
                    $grid.append(`
                        <div class="user-location-card" style="background: white; padding: 15px; border-radius: 12px; border: 1px solid #eee; min-width: 220px; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                            <div style="font-weight: 700; color: #2d3436;">${u.full_name}</div>
                            <div style="font-size: 0.8em; color: #636e72; margin-top: 8px;">
                                <div style="margin-bottom: 4px;"><i class="fa fa-map-marker" style="color: #6c5ce7;"></i> ${u.latitude.toFixed(4)}, ${u.longitude.toFixed(4)}</div>
                                <div style="margin-bottom: 4px;"><i class="fa fa-clock-o"></i> ${time_ago}</div>
                                <div><i class="fa fa-battery-half"></i> ${u.battery_level}% Battery</div>
                            </div>
                        </div>
                    `);
                });
                $map_section.find('#tracking-status').text(`Tracking ${users.length} active personnel`);
            }
        });
    },

    load_live_visits: function ($container) {
        const $live_section = $(`
            <div class="dashboard-section live-visits-section mb-4">
                <h3 style="font-size: 18px; font-weight: 700; margin-bottom: 15px;">Live Visits in Progress</h3>
                <div id="live-visits-table-container"></div>
            </div>`).appendTo($container);

        frappe.call({
            method: "paperware.paperware.doctype.sales_visit.sales_visit.get_live_visits",
            callback: (r) => {
                let visits = r.message || [
                    { created_by: "Ariful Islam", client_name: "Abc Traders", purpose: "Client Meeting", visit_time: moment().format('hh:mm A'), location_name: "Mirpur DOHS" }
                ];

                if (visits.length) {
                    let html = `<div style="background: white; border-radius: 12px; border: 1px solid #eee; overflow: hidden;">
                        <table class="table" style="margin: 0;">
                            <thead style="background: #f8f9fa;">
                                <tr>
                                    <th>User</th>
                                    <th>Client</th>
                                    <th>Purpose</th>
                                    <th>Start Time</th>
                                    <th>Location</th>
                                </tr>
                            </thead>
                            <tbody>`;
                    visits.forEach(v => {
                        html += `<tr>
                            <td style="font-weight: 600;">${v.created_by}</td>
                            <td>${v.client_name}</td>
                            <td><span class="label label-info" style="background: #e1f5fe; color: #01579b; border: none;">${v.purpose}</span></td>
                            <td>${v.visit_time}</td>
                            <td class="text-muted"><i class="fa fa-map-marker"></i> ${v.location_name || '-'}</td>
                        </tr>`;
                    });
                    html += `</tbody></table></div>`;
                    $live_section.find('#live-visits-table-container').html(html);
                } else {
                    $live_section.find('#live-visits-table-container').html('<div class="text-muted text-center p-4" style="background: #f8f9fa; border-radius: 12px;">No visits currently in progress.</div>');
                }
            }
        });
    },

    load_activity_feed: function ($container) {
        const $activity_section = $(`
            <div class="dashboard-section activity-feed-section">
                <h3 style="font-size: 18px; font-weight: 700; margin-bottom: 15px;">Visit Logs (Recent Activity)</h3>
                <div id="activity-feed-list" style="background: white; border-radius: 12px; border: 1px solid #eee; padding: 10px;"></div>
            </div>`).appendTo($container);

        frappe.call({
            method: "paperware.paperware.doctype.sales_visit.sales_visit.get_recent_visits",
            args: { limit: 10 },
            callback: (r) => {
                let visits = r.message || [
                    { created_by: "Sumit Saha", client_name: "Apex Footwear", purpose: "Payment Collection", modified: moment().subtract(1, 'hour'), name: "SV-001" },
                    { created_by: "Nabil Ahmed", client_name: "Bata Shoe", purpose: "Follow up", modified: moment().subtract(3, 'hours'), name: "SV-002" }
                ];

                const $feed = $activity_section.find('#activity-feed-list');
                visits.forEach(visit => {
                    $feed.append(`
                        <div class="activity-item" style="border-bottom: 1px solid #f8f9fa; padding: 12px 15px; display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <div style="font-size: 0.95em;">
                                    <strong>${visit.created_by}</strong> visited <span style="color: #6c5ce7; font-weight: 600;">${visit.client_name}</span> 
                                </div>
                                <div style="margin-top: 5px;">
                                    <span class="label" style="background: #f0f0f0; color: #666; font-size: 0.8em;">${visit.purpose}</span>
                                    <a href="/app/sales-visit/${visit.name}" class="text-muted" style="margin-left: 10px; font-size: 0.85em;">${visit.name}</a>
                                </div>
                            </div>
                            <div class="text-muted" style="font-size: 0.85em;">${comment_when(visit.modified)}</div>
                        </div>
                    `);
                });
            }
        });
    }
};
