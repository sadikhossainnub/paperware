frappe.provide('frappe.pages');

(function () {
    var page_key = 'sales-target-dashboard';

    if (!frappe.pages[page_key]) {
        if (frappe.pages['Sales Target Management']) {
            page_key = 'Sales Target Management';
        } else if (frappe.pages['sales_target_dashboard']) {
            page_key = 'sales_target_dashboard';
        } else {
            for (var key in frappe.pages) {
                if (key.toLowerCase().replace(/ /g, '-').replace(/_/g, '-') === 'sales-target-dashboard' ||
                    key.toLowerCase().replace(/ /g, '-').replace(/_/g, '-') === 'sales_target_dashboard') {
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
                title: 'Sales Target Management',
                single_column: true
            });

            frappe.sales_target_dashboard.render(page);
        };
    } else {
        console.warn("Sales Target Dashboard: Page key not found in frappe.pages. Available keys:", Object.keys(frappe.pages));
    }
})();

frappe.sales_target_dashboard = {
    render: function (page) {
        const $container = $(`
            <div class="sales-target-dashboard p-4">
                <div class="dashboard-header mb-4 d-flex justify-content-between align-items-center">
                    <div>
                        <h2 class="m-0" style="font-weight: 700; color: #1a202c;">Performance Overview</h2>
                        <p class="text-muted">Track sales targets vs actual achievements</p>
                    </div>
                </div>
                
                <div class="stats-grid mb-4" style="display: flex; gap: 20px;">
                    <!-- Stat cards will be injected here -->
                </div>

                <div class="row">
                    <div class="col-md-8">
                        <div class="dashboard-card chart-card mb-4" style="background: white; padding: 20px; border-radius: 12px; border: 1px solid #eee;">
                            <h5>Achievement Progress</h5>
                            <div id="achievement_chart" style="height: 350px;"></div>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="dashboard-card table-card mb-4" style="background: white; padding: 20px; border-radius: 12px; border: 1px solid #eee; height: 100%;">
                            <h5>Top Performance</h5>
                            <div id="top_performers" class="py-3">
                                <div class="text-center text-muted py-5">Loading...</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="row">
                    <div class="col-md-12">
                        <div class="dashboard-card table-card" style="background: white; padding: 20px; border-radius: 12px; border: 1px solid #eee;">
                            <h5>Target Breakdown</h5>
                            <div class="table-responsive">
                                <table class="table table-hover mb-0" id="target_breakdown_table">
                                    <thead class="bg-light">
                                        <tr>
                                            <th>Sales Person</th>
                                            <th>Target Amount</th>
                                            <th>Actual Amount</th>
                                            <th>Variance</th>
                                            <th>% Achievement</th>
                                            <th>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr><td colspan="6" class="text-center py-4">Fetching data...</td></tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `).appendTo(page.main);

        this.page = page;
        this.add_filters();
        this.load_dashboard_data();

        page.set_secondary_action('Refresh', () => {
            this.load_dashboard_data();
        });

        page.set_primary_action('New Target', () => {
            frappe.new_doc('Sales Target');
        });
    },

    add_filters: function () {
        this.fiscal_year_filter = this.page.add_field({
            label: 'Fiscal Year',
            fieldtype: 'Select',
            options: ['2024', '2025', '2026', '2027'],
            default: '2025',
            change: () => this.load_dashboard_data()
        });

        this.target_period_filter = this.page.add_field({
            label: 'Period',
            fieldtype: 'Select',
            options: ['Monthly', 'Quarterly', 'Yearly'],
            default: 'Monthly',
            change: () => this.load_dashboard_data()
        });
    },

    load_dashboard_data: function () {
        const year = this.fiscal_year_filter.get_value();
        const period = this.target_period_filter.get_value();

        frappe.call({
            method: 'paperware.paperware.doctype.sales_target.sales_target.get_dashboard_data',
            args: { fiscal_year: year, period: period },
            callback: (r) => {
                let data = r.message;

                // Demo Data Logic
                if (!data) {
                    data = {
                        stats: { total_target: "$500,000", total_actual: "$420,000", gap: "$80,000", achievement_pct: 84 },
                        charts: {
                            labels: ["Jan", "Feb", "Mar", "Apr", "May"],
                            targets: [80000, 90000, 100000, 110000, 120000],
                            actuals: [75000, 95000, 85000, 105000, 60000]
                        },
                        top_performers: [
                            { name: "Ariful Islam", pct: 95 },
                            { name: "Sumit Saha", pct: 88 },
                            { name: "Nabil Ahmed", pct: 72 }
                        ],
                        table_data: [
                            { sales_person: "Ariful Islam", target_amount: 150000, actual_amount: 142500, variance: -7500, pct: 95 },
                            { sales_person: "Sumit Saha", target_amount: 120000, actual_amount: 105600, variance: -14400, pct: 88 },
                            { sales_person: "Nabil Ahmed", target_amount: 100000, actual_amount: 72000, variance: -28000, pct: 72 }
                        ]
                    };
                }

                this.render_stats(data.stats);
                this.render_charts(data.charts);
                this.render_performers(data.top_performers);
                this.render_table(data.table_data);
            }
        });
    },

    render_stats: function (stats) {
        const $grid = $('.stats-grid');
        $grid.empty();

        const targets = [
            { label: 'Total Target', value: stats.total_target, color: '#3182ce', icon: 'fa-line-chart' },
            { label: 'Total Actual', value: stats.total_actual, color: '#38a169', icon: 'fa-check-circle' },
            { label: 'Gap to Target', value: stats.gap, color: '#e53e3e', icon: 'fa-exclamation-circle' },
            { label: 'Achievement %', value: stats.achievement_pct + '%', color: '#805ad5', icon: 'fa-trophy' }
        ];

        targets.forEach(t => {
            $grid.append(`
                <div class="stat-card" style="background: white; padding: 20px; border-radius: 12px; border: 1px solid #eee; flex: 1; border-left: 4px solid ${t.color};">
                    <div class="d-flex justify-content-between align-items-start">
                        <div>
                            <span style="font-size: 11px; font-weight: 700; color: #718096; text-transform: uppercase;">${t.label}</span>
                            <div style="font-size: 20px; font-weight: 700; color: #2d3748; margin-top: 5px;">${t.value}</div>
                        </div>
                        <i class="fa ${t.icon}" style="color: ${t.color}; font-size: 18px;"></i>
                    </div>
                </div>
            `);
        });
    },

    render_charts: function (chart_data) {
        new frappe.Chart("#achievement_chart", {
            title: "Actual vs Target Achievement",
            data: {
                labels: chart_data.labels,
                datasets: [
                    { name: "Target", values: chart_data.targets, chartType: 'bar' },
                    { name: "Actual", values: chart_data.actuals, chartType: 'bar' }
                ]
            },
            type: 'axis-mixed',
            height: 350,
            colors: ['#cbd5e0', '#3182ce']
        });
    },

    render_performers: function (performers) {
        const $container = $('#top_performers');
        $container.empty();

        performers.forEach(p => {
            $container.append(`
                <div class="performer-item mb-3">
                    <div class="d-flex justify-content-between mb-1">
                        <span style="font-weight: 600; font-size: 0.9em;">${p.name}</span>
                        <span style="color: #3182ce; font-weight: 700;">${p.pct}%</span>
                    </div>
                    <div class="progress" style="height: 6px; border-radius: 3px; background: #edf2f7;">
                        <div class="progress-bar" role="progressbar" style="width: ${p.pct}%; background-color: #3182ce;"></div>
                    </div>
                </div>
            `);
        });
    },

    render_table: function (data) {
        const $tbody = $('#target_breakdown_table tbody');
        $tbody.empty();

        data.forEach(row => {
            const status_class = row.pct >= 100 ? 'status-green' : (row.pct > 70 ? 'status-orange' : 'status-red');
            const status_text = row.pct >= 100 ? 'Achieved' : 'Pending';

            $tbody.append(`
                <tr style="font-size: 0.95em;">
                    <td style="font-weight: 600;">${row.sales_person}</td>
                    <td>${row.target_amount.toLocaleString()}</td>
                    <td>${row.actual_amount.toLocaleString()}</td>
                    <td style="color: ${row.variance < 0 ? '#e53e3e' : '#38a169'}">${row.variance.toLocaleString()}</td>
                    <td>
                        <div class="d-flex align-items-center">
                            <span style="width: 40px; font-weight: 600;">${row.pct}%</span>
                            <div class="progress" style="height: 4px; flex-grow: 1; min-width: 50px; background: #edf2f7;">
                                <div class="progress-bar" style="width: ${row.pct}%; background-color: ${row.pct >= 100 ? '#38a169' : '#3182ce'};"></div>
                            </div>
                        </div>
                    </td>
                    <td><span class="label" style="background: ${row.pct >= 100 ? '#c6f6d5' : '#e2e8f0'}; color: ${row.pct >= 100 ? '#22543d' : '#4a5568'};">${status_text}</span></td>
                </tr>
            `);
        });
    }
}
