frappe.provide('frappe.pages');

(function () {
    var page_key = 'sales-kpis';

    // Safety check for different possible keys in frappe.pages
    if (!frappe.pages[page_key]) {
        if (frappe.pages['Sales KPIs']) {
            page_key = 'Sales KPIs';
        } else if (frappe.pages['sales_kpis']) {
            page_key = 'sales_kpis';
        } else {
            // Try to find any key that matches normalized
            for (var key in frappe.pages) {
                if (key.toLowerCase().replace(/ /g, '-').replace(/_/g, '-') === 'sales-kpis' ||
                    key.toLowerCase().replace(/ /g, '-').replace(/_/g, '-') === 'sales_kpis') {
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
                title: 'Sales Performance',
                single_column: true
            });

            frappe.sales_kpis.render(page);
        };
    } else {
        console.warn("Sales Performance Dashboard: Page key not found in frappe.pages. Available keys:", Object.keys(frappe.pages));
    }
})();

frappe.sales_kpis = {
    render: function (page) {
        const $container = $(`<div class="sales-kpis-dashboard">`).appendTo(page.main);

        frappe.call({
            method: "paperware.paperware.ai_api.sales.get_sales_kpis",
            callback: (r) => {
                if (r.message) {
                    this.render_header_stats($container, r.message.header);
                    this.render_charts($container, r.message);
                }
            }
        });

        page.set_primary_action('Refresh', () => {
            $container.empty();
            this.render(page);
        });
    },

    render_header_stats: function ($container, data) {
        const stats = [
            { label: 'Total Revenue', value: format_currency(data.total_revenue), color: 'green' },
            { label: 'New Orders (Today)', value: data.new_orders, color: 'blue' },
            { label: 'Avg Order Value', value: format_currency(data.avg_order_value), color: 'purple' }
        ];

        const $stats = $(`<div class="kpi-stats-row"></div>`).appendTo($container);

        stats.forEach(s => {
            $stats.append(`
                <div class="kpi-card-simple">
                    <div class="kpi-label">${s.label}</div>
                    <div class="kpi-value">${s.value}</div>
                </div>
            `);
        });
    },

    render_charts: function ($container, data) {
        $container.append(`
            <div class="charts-grid-simple top-charts">
                <div class="chart-container-simple" id="revenue-chart"></div>
                <div class="chart-container-simple" id="orders-chart"></div>
            </div>
            <div class="charts-grid-simple bottom-charts">
                <div class="chart-container-simple full-width" id="category-chart"></div>
            </div>
        `);

        // Render Revenue Chart
        new frappe.Chart("#revenue-chart", {
            title: "Monthly Revenue Trend",
            data: {
                labels: data.revenue_trend.labels,
                datasets: [{ name: "Revenue", type: "line", values: data.revenue_trend.values }]
            },
            type: 'line',
            height: 250,
            colors: ['#7cd6fd']
        });

        // Render Orders Chart
        new frappe.Chart("#orders-chart", {
            title: "Orders by Status",
            data: {
                labels: data.status_counts.map(s => s.status),
                datasets: [{ name: "Orders", values: data.status_counts.map(s => s.count) }]
            },
            type: 'donut',
            height: 250,
            colors: ['#28a745', '#ffc107', '#dc3545', '#6c757d', '#5e64ff']
        });

        // Render Category Chart
        new frappe.Chart("#category-chart", {
            title: "Top 5 Sales by Product Category",
            data: {
                labels: data.category_sales.map(s => s.item_group),
                datasets: [{ name: "Sales", values: data.category_sales.map(s => s.total_amount) }]
            },
            type: 'bar',
            height: 300,
            colors: ['#5e64ff']
        });
    }
};
