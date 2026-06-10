frappe.provide('frappe.pages');

(function () {
    var page_key = 'live-location-feed';

    // Safety check for different possible keys in frappe.pages
    if (!frappe.pages[page_key]) {
        if (frappe.pages['Live Location Feed']) {
            page_key = 'Live Location Feed';
        } else if (frappe.pages['live_location_feed']) {
            page_key = 'live_location_feed';
        } else {
            // Try to find any key that matches normalized
            for (var key in frappe.pages) {
                if (key.toLowerCase().replace(/ /g, '-').replace(/_/g, '-') === 'live-location-feed' ||
                    key.toLowerCase().replace(/ /g, '-').replace(/_/g, '-') === 'live_location_feed') {
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
                title: 'Live Location Feed',
                single_column: true
            });

            // Create container
            const $container = $(`<div class="live-location-feed" style="min-height: 500px;"></div>`).appendTo(page.main);

            // Split view: Sidebar (User List) + Main (Map/Timeline)
            const $splitView = $(`
                <div class="row" style="height: 80vh;">
                    <div class="col-md-3" style="height: 100%; overflow-y: auto; border-right: 1px solid #ddd; padding-right: 0;">
                        <div class="user-list-header" style="padding: 10px; border-bottom: 1px solid #ddd;">
                             <input type="text" class="form-control input-sm user-search" placeholder="Search User...">
                        </div>
                        <div class="user-list-body" style="padding: 0;">
                            <div class="text-muted text-center" style="padding: 20px;">Loading users...</div>
                        </div>
                    </div>
                    <div class="col-md-9" style="height: 100%; display: flex; flex-direction: column;">
                        <div class="map-controls" style="padding: 10px; background: #f7f7f7; border-bottom: 1px solid #ddd; display: flex; justify-content: space-between; align-items: center;">
                            <div class="left-controls">
                                <span id="selected-user-name" style="font-weight: bold; font-size: 1.1em; margin-right: 15px;">Live View</span>
                                <span id="connection-status" class="indicator grey">Waiting...</span>
                                <span id="demo-badge-location" class="badge badge-warning ml-2" style="display:none; font-size: 10px; vertical-align: middle;">DEMO DATA</span>
                            </div>
                            <div class="right-controls form-inline">
                                 <div class="form-group">
                                    <label>Date: </label>
                                    <input type="date" class="form-control input-sm" id="timeline-date" value="${frappe.datetime.get_today()}">
                                </div>
                                <button class="btn btn-default btn-sm" id="btn-refresh"><i class="fa fa-refresh"></i></button>
                            </div>
                        </div>
                        <div id="map-container" style="flex: 1; background: #eee; position: relative; overflow: auto; padding: 20px;">
                            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: #777;">
                                Map loading...
                            </div>
                        </div>
                        <div id="timeline-slider-container" style="padding: 15px; background: white; border-top: 1px solid #ddd; display: none;">
                            <label>Timeline Replay</label>
                            <input type="range" min="0" max="100" value="100" class="web-form-input" style="width: 100%;">
                            <div style="display: flex; justify-content: space-between; font-size: 0.8em; color: #888; margin-top: 5px;">
                                <span id="time-start">00:00</span>
                                <span id="time-current">Now</span>
                                <span id="time-end">23:59</span>
                            </div>
                        </div>
                    </div>
                </div>
            `).appendTo($container);

            // Initialize Logic
            frappe.live_location_feed.init($container);
        };
    } else {
        console.warn("Live Location Feed: Page key not found in frappe.pages. Available keys:", Object.keys(frappe.pages));
    }
})();

frappe.live_location_feed = {
    state: {
        users: [],
        selectedUser: null,
        selectedDate: frappe.datetime.get_today(),
        liveMode: true,
        polling: null,
        isDemo: false
    },

    init: function ($container) {
        this.$userList = $container.find('.user-list-body');
        this.$map = $container.find('#map-container');
        this.$timelineDate = $container.find('#timeline-date');
        this.$status = $container.find('#connection-status');
        this.$demoBadge = $container.find('#demo-badge-location');

        // Bind items
        this.$timelineDate.on('change', (e) => {
            this.state.selectedDate = e.target.value;
            this.state.liveMode = (this.state.selectedDate === frappe.datetime.get_today());
            if (this.state.selectedUser) {
                this.load_user_timeline(this.state.selectedUser);
            }
        });

        $container.find('#btn-refresh').click(() => {
            this.fetch_live_locations();
        });

        // Start Polling
        this.fetch_live_locations();
        this.start_polling();
    },

    start_polling: function () {
        if (this.state.polling) clearInterval(this.state.polling);
        this.state.polling = setInterval(() => {
            if (this.state.liveMode) {
                this.fetch_live_locations(true); // silent update
            }
        }, 5000); // 5 seconds interval
    },

    fetch_live_locations: function (silent = false) {
        frappe.call({
            method: "paperware.logistics_fleet.doctype.user_location_log.user_location_log.get_latest_locations",
            callback: (r) => {
                let locations = r.message || [];

                // Demo Data Logic
                if (locations.length < 2) {
                    this.state.isDemo = true;
                    this.$demoBadge.show();
                    locations = [
                        { "user": "rahmat@paperware.com", "full_name": "Rahmat Ali", "latitude": 23.8103, "longitude": 90.4125, "timestamp": moment().subtract(2, 'minutes').format('YYYY-MM-DD HH:mm:ss'), "battery_level": 85, "speed": 12 },
                        { "user": "sumit@paperware.com", "full_name": "Sumit Saha", "latitude": 23.7509, "longitude": 90.3935, "timestamp": moment().subtract(10, 'minutes').format('YYYY-MM-DD HH:mm:ss'), "battery_level": 45, "speed": 0 },
                        { "user": "nabil@paperware.com", "full_name": "Nabil Ahmed", "latitude": 23.8817, "longitude": 90.3994, "timestamp": moment().subtract(1, 'minutes').format('YYYY-MM-DD HH:mm:ss'), "battery_level": 92, "speed": 45 }
                    ];
                } else {
                    this.state.isDemo = false;
                    this.$demoBadge.hide();
                }

                this.state.users = locations;
                this.render_user_list();
                this.$status.removeClass('grey').addClass('green').text('Stable');
            }
        });
    },

    render_user_list: function () {
        this.$userList.empty();
        if (this.state.users.length === 0) {
            this.$userList.append('<div class="text-center text-muted p-3">No active users</div>');
            return;
        }

        this.state.users.forEach(u => {
            const isOnline = moment(u.timestamp).isAfter(moment().subtract(5, 'minutes'));
            const statusColor = isOnline ? 'green' : 'grey';
            const statusText = isOnline ? 'Online' : 'Offline';
            const timeAgo = comment_when(u.timestamp);

            const $item = $(`
                <div class="user-list-item" style="padding: 10px; border-bottom: 1px solid #eee; cursor: pointer; transition: background 0.2s;" data-user="${u.user}">
                    <div style="display: flex; align-items: center;">
                        <div class="avatar avatar-medium" style="margin-right: 10px;">
                             ${u.user_image ? `<img src="${u.user_image}">` : `<div class="standard-image" style="background-color: var(--primary-color); color: white;">${frappe.get_abbr(u.full_name)}</div>`}
                        </div>
                        <div style="flex: 1;">
                            <div style="font-weight: bold;">${u.full_name}</div>
                            <div style="font-size: 0.85em; color: #666;">
                                <span class="indicator ${statusColor}"></span> ${statusText}
                            </div>
                            <div style="font-size: 0.75em; color: #999; margin-top: 2px;">
                                <i class="fa fa-clock-o"></i> ${timeAgo}
                            </div>
                        </div>
                    </div>
                </div>
            `);

            $item.click(() => {
                this.$userList.find('.user-list-item').css('background', 'transparent');
                $item.css('background', '#f0f4ff');
                this.state.selectedUser = u.user;
                this.state.selectedUserName = u.full_name;
                $('#selected-user-name').text(u.full_name);
                this.load_user_timeline(u.user);
            });

            if (this.state.selectedUser === u.user) {
                $item.css('background', '#f0f4ff');
            }

            this.$userList.append($item);
        });
    },

    load_user_timeline: function (user) {
        this.$map.html('<div class="text-center" style="padding-top: 100px;">Loading history...</div>');

        if (this.state.isDemo) {
            const demoLogs = [];
            for (let i = 0; i < 10; i++) {
                demoLogs.push({
                    timestamp: moment().subtract(i * 15, 'minutes').format('YYYY-MM-DD HH:mm:ss'),
                    latitude: 23.8103 + (i * 0.001),
                    longitude: 90.4125 + (i * 0.001),
                    accuracy: 10,
                    battery_level: 85 - i,
                    speed: 10 + i
                });
            }
            this.render_map_path(demoLogs);
            return;
        }

        // Fetch history
        frappe.call({
            method: "paperware.logistics_fleet.doctype.user_location_log.user_location_log.get_user_location_history",
            args: {
                user: user,
                date: this.state.selectedDate
            },
            callback: (r) => {
                if (r.message && r.message.length > 0) {
                    this.render_map_path(r.message);
                } else {
                    this.$map.html('<div class="text-center text-muted" style="padding-top: 100px;">No location history found for this date.</div>');
                }
            }
        });
    },

    render_map_path: function (logs) {
        let html = `<div style="padding: 20px;">
            <h4 style="font-weight: 700;">Timeline: ${this.state.selectedUserName}</h4>
            <div class="alert alert-info" style="margin-bottom: 20px; border-radius: 12px; background: #e3f2fd; border: none; color: #1565c0;">
                <i class="fa fa-info-circle"></i> Found <strong>${logs.length}</strong> tracked location points for ${this.state.selectedDate}.
            </div>
            
            <div class="row">
                <div class="col-md-12">
                    <div class="glass-table-container" style="background: white; border-radius: 16px; border: 1px solid #eee; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                        <table class="table table-hover" style="margin: 0;">
                            <thead style="background: #f8f9fa;">
                                <tr>
                                    <th style="padding: 15px;">Time</th>
                                    <th style="padding: 15px;">Coordinates</th>
                                    <th style="padding: 15px;">Accuracy</th>
                                    <th style="padding: 15px;">Battery</th>
                                    <th style="padding: 15px;">Speed</th>
                                </tr>
                            </thead>
                            <tbody>`;

        logs.forEach(l => {
            html += `<tr>
                    <td style="padding: 12px 15px;">${moment(l.timestamp).format('hh:mm:ss A')}</td>
                    <td style="padding: 12px 15px;">
                        <a href="https://www.google.com/maps/search/?api=1&query=${l.latitude},${l.longitude}" target="_blank" style="color: #6c5ce7; font-weight: 500;">
                            <i class="fa fa-map-marker"></i> ${l.latitude.toFixed(4)}, ${l.longitude.toFixed(4)}
                        </a>
                    </td>
                    <td style="padding: 12px 15px;"><span class="label label-default" style="background: #eee; color: #666; font-weight: 500;">${parseInt(l.accuracy || 0)}m</span></td>
                    <td style="padding: 12px 15px;">
                        <div class="progress" style="height: 6px; margin-bottom: 0; width: 60px; display: inline-block; vertical-align: middle; margin-right: 5px;">
                            <div class="progress-bar ${l.battery_level < 20 ? 'progress-bar-danger' : 'progress-bar-success'}" style="width: ${l.battery_level}%"></div>
                        </div>
                        <span style="font-size: 0.9em; font-weight: 600;">${parseInt(l.battery_level || 0)}%</span>
                    </td>
                    <td style="padding: 12px 15px;"><span style="font-weight: 600;">${parseInt(l.speed || 0)}</span> <small class="text-muted">km/h</small></td>
                </tr>`;
        });

        html += `</tbody></table></div></div></div></div>`;
        this.$map.html(html);
    }
};
