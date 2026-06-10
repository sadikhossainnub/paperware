frappe.provide('frappe.pages');

(function () {
    var page_key = 'hr-modern-dashboard';

    // Safety check for different possible keys in frappe.pages
    if (!frappe.pages[page_key]) {
        if (frappe.pages['HR Modern Dashboard']) {
            page_key = 'HR Modern Dashboard';
        } else if (frappe.pages['hr_modern_dashboard']) {
            page_key = 'hr_modern_dashboard';
        } else {
            // Try to find any key that matches normalized
            for (var key in frappe.pages) {
                if (key.toLowerCase().replace(/ /g, '-').replace(/_/g, '-') === 'hr-modern-dashboard') {
                    page_key = key;
                    break;
                }
            }
        }
    }

    if (frappe.pages[page_key]) {
        frappe.pages[page_key].on_page_load = function (wrapper) {
            let page = frappe.ui.make_app_page({
                parent: wrapper,
                title: 'HR Modern Dashboard',
                single_column: true
            });

            wrapper.dashboard = new HRDashboard(wrapper, page);
        };
    } else {
        console.warn("HR Modern Dashboard: Page key not found in frappe.pages. Available keys:", Object.keys(frappe.pages));
    }
})();

class HRDashboard {
    constructor(wrapper, page) {
        this.wrapper = $(wrapper);
        this.page = page;
        this.map = null;
        this.markers = {};
        this.init();
    }

    init() {
        this.render_html();
        this.fetch_data();
        this.setup_events();
        this.start_auto_refresh();
    }

    render_html() {
        const html = `
        <div class="hr-dashboard-wrapper">
            <!-- Header Section -->
            <div class="dashboard-header d-flex justify-content-between align-items-center mb-4">
                <div class="title-area">
                    <h1 class="h2 mb-0">HR Commander Dashboard</h1>
                    <p class="text-muted small">Real-time Employee Status & Analytics</p>
                </div>
                <div class="status-indicator d-flex align-items-center">
                    <span class="pulse-icon mr-2"></span>
                    <span class="live-status">LIVE MONITORING</span>
                    <button class="btn btn-primary btn-sm ml-3" id="refresh-dashboard">
                        <i class="fa fa-refresh mr-1"></i> Refresh
                    </button>
                </div>
            </div>

            <!-- KPI Cards -->
            <div class="row kpi-section">
                <div class="col-md-2-4">
                    <div class="kpi-card glass-card purple">
                        <div class="kpi-icon"><i class="fa fa-users"></i></div>
                        <div class="kpi-content">
                            <div class="kpi-value" id="total-employees">0</div>
                            <div class="kpi-label">Total Staff</div>
                        </div>
                    </div>
                </div>
                <div class="col-md-2-4">
                    <div class="kpi-card glass-card green">
                        <div class="kpi-icon"><i class="fa fa-check-circle"></i></div>
                        <div class="kpi-content">
                            <div class="kpi-value" id="present-today">0</div>
                            <div class="kpi-label">Present</div>
                        </div>
                    </div>
                </div>
                <div class="col-md-2-4">
                    <div class="kpi-card glass-card red">
                        <div class="kpi-icon"><i class="fa fa-clock-o"></i></div>
                        <div class="kpi-content">
                            <div class="kpi-value" id="late-today">0</div>
                            <div class="kpi-label">Late Entries</div>
                        </div>
                    </div>
                </div>
                <div class="col-md-2-4">
                    <div class="kpi-card glass-card gold">
                        <div class="kpi-icon"><i class="fa fa-user-times"></i></div>
                        <div class="kpi-content">
                            <div class="kpi-value" id="absent-today">0</div>
                            <div class="kpi-label">Absent Today</div>
                        </div>
                    </div>
                </div>
                <div class="col-md-2-4">
                    <div class="kpi-card glass-card cyan">
                        <div class="kpi-icon"><i class="fa fa-plane"></i></div>
                        <div class="kpi-content">
                            <div class="kpi-value" id="on-leave">0</div>
                            <div class="kpi-label">On Leave</div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="row mt-4">
                <!-- Live Map Monitoring -->
                <div class="col-lg-8">
                    <div class="glass-card map-container-box mb-4">
                        <div class="card-header-modern d-flex justify-content-between align-items-center mb-3">
                            <h5 class="mb-0">Live Employee Monitoring</h5>
                            <div class="map-controls">
                                <span class="badge badge-success">GPS Active</span>
                            </div>
                        </div>
                        <div id="employee-map" style="height: 450px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1);"></div>
                    </div>
                    
                    <!-- Attendance Trend Chart -->
                    <div class="glass-card trend-container">
                        <div class="card-header-modern mb-3">
                            <h5 class="mb-0">Weekly Presence Trend</h5>
                        </div>
                        <div id="attendance-trend-chart" style="height: 250px;"></div>
                    </div>
                </div>

                <!-- Sidebar Activity Feed -->
                <div class="col-lg-4">
                    <div class="glass-card feed-container">
                        <div class="card-header-modern mb-3">
                            <h5 class="mb-0">Real-Time Activity</h5>
                        </div>
                        <div class="activity-feed" id="activity-feed-list">
                            <div class="text-center p-5 text-muted">Loading feed...</div>
                        </div>
                    </div>

                    <!-- Quick Reports -->
                    <div class="glass-card mt-4 shortcuts-container">
                        <div class="card-header-modern mb-3">
                            <h5 class="mb-0">HR Quick Reports</h5>
                        </div>
                        <div class="list-group list-group-flush">
                            <a href="/app/report/Daily Attendance Report" class="list-group-item list-group-item-action glass-item">
                                <i class="fa fa-file-text-o mr-2"></i> Attendance Report
                            </a>
                            <a href="/app/report/Monthly Attendance Sheet" class="list-group-item list-group-item-action glass-item">
                                <i class="fa fa-calendar mr-2"></i> Monthly Sheet
                            </a>
                            <a href="/app/employee" class="list-group-item list-group-item-action glass-item">
                                <i class="fa fa-user mr-2"></i> Employee List
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;

        this.page.main.empty().append(html);
    }

    setup_events() {
        this.page.main.on('click', '#refresh-dashboard', () => {
            this.fetch_data();
        });
    }

    start_auto_refresh() {
        if (this.refresh_interval) clearInterval(this.refresh_interval);
        this.refresh_interval = setInterval(() => {
            this.fetch_data();
        }, 60000);
    }

    fetch_data() {
        frappe.call({
            method: 'paperware.paperware.page.hr_modern_dashboard.hr_modern_dashboard.get_dashboard_data',
            callback: (r) => {
                if (r.message) {
                    this.update_demo_indicator(r.message.is_demo);
                    this.update_kpis(r.message.kpis);
                    this.update_activity_feed(r.message.recent_activity);
                    this.init_map(r.message.live_locations);
                    this.render_charts(r.message.weekly_trend);
                }
            }
        });
    }

    update_demo_indicator(is_demo) {
        if (is_demo) {
            if (this.page.main.find('#demo-badge').length === 0) {
                this.page.main.find('.live-status').after('<span id="demo-badge" class="badge badge-warning ml-2" style="font-size: 10px; vertical-align: middle;">DEMO DATA</span>');
            }
        } else {
            this.page.main.find('#demo-badge').remove();
        }
    }

    update_kpis(kpis) {
        this.page.main.find('#total-employees').text(kpis.total_employees || 0);
        this.page.main.find('#present-today').text(kpis.present_today || 0);
        this.page.main.find('#late-today').text(kpis.late_today || 0);
        this.page.main.find('#absent-today').text(kpis.absent_today || 0);
        this.page.main.find('#on-leave').text(kpis.on_leave || 0);
    }

    update_activity_feed(activities) {
        let $feed = this.page.main.find('#activity-feed-list');
        if (!$feed.length) return;
        $feed.empty();

        if (!activities || activities.length === 0) {
            $feed.append('<div class="text-center p-3 text-muted">No activity today</div>');
            return;
        }

        activities.forEach(act => {
            // Robust time handling to fix deprecation warning
            let time = 'N/A';
            if (act.in_time) {
                if (typeof act.in_time === 'string' && act.in_time.length === 8) {
                    time = act.in_time.substring(0, 5); // Just HH:mm
                } else {
                    try {
                        time = frappe.datetime.get_time(act.in_time);
                    } catch (e) {
                        time = act.in_time;
                    }
                }
            }

            let late_class = act.late_entry ? 'late' : '';
            let status_label = act.late_entry ? 'LATE' : (act.status || 'Present');

            let item = `
                <div class="activity-item ${late_class}">
                    <div>
                        <div class="name">${act.employee_name || 'Unknown'}</div>
                        <div class="small text-muted">${status_label}</div>
                    </div>
                    <div class="text-right">
                        <div class="time">${time}</div>
                    </div>
                </div>
            `;
            $feed.append(item);
        });
    }

    init_map(locations) {
        if (!locations || locations.length === 0) return;

        let map_el = this.page.main.find('#employee-map');
        if (!map_el.length) return;

        if (this.map) {
            this.update_markers(locations);
            return;
        }

        frappe.require([
            "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
            "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
        ], () => {
            if (!this.map) {
                this.map = L.map(map_el[0]).setView([23.8103, 90.4125], 12);
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '&copy; OpenStreetMap contributors'
                }).addTo(this.map);
            }
            this.update_markers(locations);
        });
    }

    update_markers(locations) {
        if (!this.map) return;
        locations.forEach(loc => {
            if (loc.latitude && loc.longitude) {
                if (this.markers[loc.user]) {
                    this.markers[loc.user].setLatLng([loc.latitude, loc.longitude]);
                } else {
                    let marker = L.marker([loc.latitude, loc.longitude]).addTo(this.map);
                    marker.bindPopup(`<b>${loc.employee_name || loc.user}</b><br>${loc.address || 'Checking loc...'}<br><small>${loc.timestamp}</small>`);
                    this.markers[loc.user] = marker;
                }
            }
        });
        if (locations.length > 0 && locations[0].latitude) {
            this.map.panTo([locations[0].latitude, locations[0].longitude]);
        }
    }

    render_charts(trend) {
        if (!trend || trend.length === 0) return;
        let chart_el = this.page.main.find('#attendance-trend-chart');
        if (!chart_el.length) return;

        let labels = trend.map(t => frappe.datetime.str_to_user(t.date));
        let values = trend.map(t => t.count);

        new frappe.Chart(chart_el[0], {
            title: "Attendance Trend (Last 7 Days)",
            data: { labels: labels, datasets: [{ name: "Present", type: "bar", values: values }] },
            type: 'bar',
            height: 250,
            colors: ['#6c5ce7']
        });
    }
}
