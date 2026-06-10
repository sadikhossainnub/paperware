frappe.pages['vehicle-travel-history'].on_page_load = function (wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: __('Vehicle Travel History'),
        single_column: true
    });

    frappe.vehicle_travel_history.init(page);
}

frappe.vehicle_travel_history = {
    state: {
        selectedVehicle: null,
        selectedDate: frappe.datetime.get_today(),
        logs: [],
        stats: {},
        map: null,
        routePolyline: null,
        markers: [],
        currentIndex: 0,
        isPlaying: false,
        playInterval: null
    },

    init: function (page) {
        this.page = page;
        this.render();
        this.make_filters();

        // Primary action: Sync from GPS
        page.set_primary_action(__('Sync from GPS'), () => {
            this.sync_from_gps();
        }, 'octicon octicon-sync');

        // Secondary action: Refresh
        page.set_secondary_action(__('Refresh'), () => {
            if (this.state.selectedVehicle) {
                this.load_history();
            }
        });
    },

    render: function () {
        const $container = $(`<div class="vehicle-travel-history"></div>`).appendTo(this.page.main);

        const html = `
            <div class="travel-history-wrapper">
                <!-- Controls Section -->
                <div class="controls-section">
                    <div class="row">
                        <div class="col-md-4">
                            <div id="vehicle-picker"></div>
                        </div>
                        <div class="col-md-3">
                            <div id="date-picker"></div>
                        </div>
                        <div class="col-md-2">
                            <label>&nbsp;</label>
                            <button class="btn btn-primary btn-block" id="btn-load-history" style="margin-top: 5px; height: 38px;">
                                <i class="fa fa-search"></i> ${__('View History')}
                            </button>
                        </div>
                        <div class="col-md-3">
                        </div>
                    </div>
                </div>

                <!-- Stats Cards -->
                <div class="stats-section" id="stats-section" style="display:none;">
                    <div class="stats-grid">
                        <div class="stat-card">
                            <div class="stat-icon"><i class="fa fa-road"></i></div>
                            <div class="stat-content">
                                <div class="stat-value" id="stat-distance">0 km</div>
                                <div class="stat-label">${__('Distance')}</div>
                            </div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon"><i class="fa fa-clock-o"></i></div>
                            <div class="stat-content">
                                <div class="stat-value" id="stat-time">0h 0m</div>
                                <div class="stat-label">${__('Travel Time')}</div>
                            </div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon"><i class="fa fa-map-marker"></i></div>
                            <div class="stat-content">
                                <div class="stat-value" id="stat-stops">0</div>
                                <div class="stat-label">${__('Stops')}</div>
                            </div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon"><i class="fa fa-tachometer"></i></div>
                            <div class="stat-content">
                                <div class="stat-value" id="stat-maxspeed">0 km/h</div>
                                <div class="stat-label">${__('Max Speed')}</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Map Section -->
                <div class="map-section">
                    <div id="travel-map" class="travel-map">
                        <div class="map-placeholder">
                            <i class="fa fa-map-o fa-3x"></i>
                            <p>${__('Select a vehicle and date to view travel history')}</p>
                        </div>
                    </div>
                </div>

                <!-- Timeline Slider -->
                <div class="timeline-section" id="timeline-section" style="display:none;">
                    <div class="timeline-controls">
                        <button class="btn btn-sm btn-default" id="btn-play">
                            <i class="fa fa-play"></i>
                        </button>
                        <button class="btn btn-sm btn-default" id="btn-prev">
                            <i class="fa fa-step-backward"></i>
                        </button>
                        <button class="btn btn-sm btn-default" id="btn-next">
                            <i class="fa fa-step-forward"></i>
                        </button>
                        <span class="timeline-info" id="timeline-info">--:--</span>
                    </div>
                    <div class="timeline-slider-wrapper">
                        <input type="range" class="timeline-slider" id="timeline-slider" min="0" max="100" value="0">
                        <div class="timeline-markers" id="timeline-markers"></div>
                    </div>
                    <div class="timeline-labels">
                        <span id="time-start">--:--</span>
                        <span id="time-end">--:--</span>
                    </div>
                </div>

                <!-- Timeline Table -->
                <div class="table-section" id="table-section" style="display:none;">
                    <div class="section-header">
                        <h4><i class="fa fa-list"></i> ${__('Location Timeline')}</h4>
                    </div>
                    <div class="table-responsive">
                        <table class="table table-hover timeline-table" id="timeline-table">
                            <thead>
                                <tr>
                                    <th>${__('Time')}</th>
                                    <th>${__('Location')}</th>
                                    <th>${__('Speed')}</th>
                                    <th>${__('Status')}</th>
                                </tr>
                            </thead>
                            <tbody id="timeline-tbody">
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;

        $container.html(html);

        // Bind events
        this.bind_events($container);
    },

    bind_events: function ($container) {
        const self = this;

        $container.find('#btn-load-history').click(() => {
            self.state.selectedVehicle = self.vehicle_control.get_value();
            self.state.selectedDate = self.date_control.get_value();

            if (self.state.selectedVehicle && self.state.selectedDate) {
                self.load_history();
            } else {
                frappe.msgprint(__('Please select both vehicle and date'));
            }
        });

        // Timeline controls
        $container.find('#btn-play').click(() => self.toggle_play());
        $container.find('#btn-prev').click(() => self.move_timeline(-1));
        $container.find('#btn-next').click(() => self.move_timeline(1));
        $container.find('#timeline-slider').on('input', function () {
            const value = parseInt($(this).val());
            self.set_timeline_position(value);
        });
    },

    make_filters: function () {
        const self = this;

        this.vehicle_control = frappe.ui.form.make_control({
            parent: $('#vehicle-picker'),
            df: {
                label: __('Select Vehicle'),
                fieldname: 'vehicle',
                fieldtype: 'Link',
                options: 'Vehicle',
                get_query: function () {
                    return {
                        filters: {
                            docstatus: ['!=', 2]
                        }
                    };
                },
                onchange: function () {
                    self.state.selectedVehicle = this.get_value();
                }
            },
            render_input: true
        });

        this.date_control = frappe.ui.form.make_control({
            parent: $('#date-picker'),
            df: {
                label: __('Date'),
                fieldname: 'date',
                fieldtype: 'Date',
                default: frappe.datetime.get_today(),
                onchange: function () {
                    self.state.selectedDate = this.get_value();
                }
            },
            render_input: true
        });
    },



    load_history: function () {
        const self = this;

        $('#travel-map').html('<div class="map-placeholder"><i class="fa fa-spinner fa-spin fa-3x"></i><p>Loading history...</p></div>');

        frappe.call({
            method: "paperware.logistics_fleet.doctype.vehicle_location_log.vehicle_location_log.get_vehicle_history",
            args: {
                vehicle: this.state.selectedVehicle,
                date: this.state.selectedDate
            },
            callback: (r) => {
                let logs = r.message?.logs || [];
                let stats = r.message?.stats || {};

                self.state.logs = logs;
                self.state.stats = stats;
                self.state.currentIndex = logs.length - 1;

                if (logs.length > 0) {
                    self.show_stats(stats);
                    self.render_map(logs);
                    self.render_timeline(logs);
                    self.render_table(logs);

                    $('#stats-section, #timeline-section, #table-section').fadeIn();
                } else {
                    $('#travel-map').html('<div class="map-placeholder"><i class="fa fa-info-circle fa-3x"></i><p>No location data found for this date. Click "Sync from GPS" to fetch data.</p></div>');
                    $('#stats-section, #timeline-section, #table-section').hide();
                }
            }
        });
    },

    show_stats: function (stats) {
        const hours = Math.floor(stats.travel_time / 60);
        const mins = Math.round(stats.travel_time % 60);

        $('#stat-distance').text(`${stats.total_distance} km`);
        $('#stat-time').text(`${hours}h ${mins}m`);
        $('#stat-stops').text(stats.stop_count);
        $('#stat-maxspeed').text(`${stats.max_speed} km/h`);
    },

    render_map: function (logs) {
        if (!logs.length) return;

        const firstLog = logs[0];
        const lastLog = logs[logs.length - 1];

        // Build map HTML with Leaflet
        const routeCoords = logs.map(l => `[${l.latitude}, ${l.longitude}]`).join(',');

        const stopMarkers = logs.filter(l => l.is_stop).map(l => `
            L.marker([${l.latitude}, ${l.longitude}], {
                icon: L.divIcon({
                    className: 'stop-marker',
                    html: '<div class="stop-marker-inner"><i class="fa fa-stop-circle"></i></div>',
                    iconSize: [24, 24],
                    iconAnchor: [12, 12]
                })
            }).addTo(map).bindPopup("<b>${l.address || 'Stop'}</b><br>Duration: ${l.stop_duration || 0} min<br>Time: ${moment(l.timestamp).format('hh:mm A')}");
        `).join('\n');

        const mapContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
                <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
                <style>
                    body { margin: 0; }
                    #map { height: 100vh; width: 100vw; }
                    .stop-marker-inner {
                        background: #e74c3c;
                        color: white;
                        border-radius: 50%;
                        width: 24px;
                        height: 24px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                    }
                    .start-marker, .end-marker {
                        background: white;
                        border-radius: 50%;
                        padding: 5px;
                        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                    }
                    .start-marker { color: #27ae60; }
                    .end-marker { color: #e74c3c; }
                    .current-marker {
                        background: #3498db;
                        color: white;
                        border-radius: 50%;
                        width: 20px;
                        height: 20px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        box-shadow: 0 2px 12px rgba(52, 152, 219, 0.5);
                        animation: pulse 1.5s infinite;
                    }
                    @keyframes pulse {
                        0% { box-shadow: 0 0 0 0 rgba(52, 152, 219, 0.7); }
                        70% { box-shadow: 0 0 0 15px rgba(52, 152, 219, 0); }
                        100% { box-shadow: 0 0 0 0 rgba(52, 152, 219, 0); }
                    }
                </style>
            </head>
            <body>
                <div id="map"></div>
                <script>
                    var map = L.map('map').setView([${firstLog.latitude}, ${firstLog.longitude}], 13);
                    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                        attribution: 'OpenStreetMap'
                    }).addTo(map);
                    
                    // Route polyline
                    var routeCoords = [${routeCoords}];
                    var routeLine = L.polyline(routeCoords, {
                        color: '#3498db',
                        weight: 4,
                        opacity: 0.8
                    }).addTo(map);
                    
                    // Start marker
                    L.marker([${firstLog.latitude}, ${firstLog.longitude}], {
                        icon: L.divIcon({
                            className: 'start-marker',
                            html: '<i class="fa fa-play-circle fa-2x" style="color:#27ae60;"></i>',
                            iconSize: [32, 32],
                            iconAnchor: [16, 16]
                        })
                    }).addTo(map).bindPopup("<b>Start</b><br>${moment(firstLog.timestamp).format('hh:mm A')}");
                    
                    // End marker
                    L.marker([${lastLog.latitude}, ${lastLog.longitude}], {
                        icon: L.divIcon({
                            className: 'end-marker',
                            html: '<i class="fa fa-stop-circle fa-2x" style="color:#e74c3c;"></i>',
                            iconSize: [32, 32],
                            iconAnchor: [16, 16]
                        })
                    }).addTo(map).bindPopup("<b>End</b><br>${moment(lastLog.timestamp).format('hh:mm A')}");
                    
                    // Stop markers
                    ${stopMarkers}
                    
                    // Current position marker (for timeline replay)
                    var currentMarker = L.marker([${lastLog.latitude}, ${lastLog.longitude}], {
                        icon: L.divIcon({
                            className: 'current-marker-wrapper',
                            html: '<div class="current-marker"><i class="fa fa-car"></i></div>',
                            iconSize: [20, 20],
                            iconAnchor: [10, 10]
                        })
                    }).addTo(map);
                    
                    // Fit bounds
                    map.fitBounds(routeLine.getBounds().pad(0.1));
                    
                    // Communication with parent
                    window.updateCurrentPosition = function(lat, lng) {
                        currentMarker.setLatLng([lat, lng]);
                        map.panTo([lat, lng]);
                    };
                </script>
            </body>
            </html>
        `;

        const blob = new Blob([mapContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        $('#travel-map').html(`<iframe id="map-iframe" src="${url}" style="width:100%; height:100%; border:none;"></iframe>`);
    },

    render_timeline: function (logs) {
        if (logs.length < 2) return;

        const $slider = $('#timeline-slider');
        $slider.attr('min', 0).attr('max', logs.length - 1).val(logs.length - 1);

        // Set time labels
        $('#time-start').text(moment(logs[0].timestamp).format('hh:mm A'));
        $('#time-end').text(moment(logs[logs.length - 1].timestamp).format('hh:mm A'));
        $('#timeline-info').text(moment(logs[logs.length - 1].timestamp).format('hh:mm A'));

        // Add markers for stops
        const $markers = $('#timeline-markers');
        $markers.empty();
        logs.forEach((log, index) => {
            if (log.is_stop) {
                const percent = (index / (logs.length - 1)) * 100;
                $markers.append(`<div class="stop-tick" style="left:${percent}%" title="${log.address || 'Stop'}"></div>`);
            }
        });
    },

    render_table: function (logs) {
        const $tbody = $('#timeline-tbody');
        $tbody.empty();

        logs.forEach((log, index) => {
            const time = moment(log.timestamp).format('hh:mm:ss A');
            const speed = log.speed ? `${Math.round(log.speed)} km/h` : '0 km/h';
            const status = log.is_stop
                ? `<span class="status-badge stop"><i class="fa fa-pause-circle"></i> Stop (${log.stop_duration || 0}m)</span>`
                : `<span class="status-badge moving"><i class="fa fa-car"></i> Moving</span>`;
            const location = log.address
                ? log.address
                : `<a href="https://www.google.com/maps/search/?api=1&query=${log.latitude},${log.longitude}" target="_blank" class="coord-link">
                    <i class="fa fa-map-marker"></i> ${log.latitude.toFixed(4)}, ${log.longitude.toFixed(4)}
                   </a>`;

            $tbody.append(`
                <tr class="timeline-row ${log.is_stop ? 'stop-row' : ''}" data-index="${index}">
                    <td class="time-col">${time}</td>
                    <td class="location-col">${location}</td>
                    <td class="speed-col">${speed}</td>
                    <td class="status-col">${status}</td>
                </tr>
            `);
        });

        // Row click handler
        $tbody.find('.timeline-row').click((e) => {
            const index = parseInt($(e.currentTarget).data('index'));
            this.set_timeline_position(index);
            $('#timeline-slider').val(index);
        });
    },

    set_timeline_position: function (index) {
        if (index < 0 || index >= this.state.logs.length) return;

        this.state.currentIndex = index;
        const log = this.state.logs[index];

        // Update timeline info
        $('#timeline-info').text(moment(log.timestamp).format('hh:mm A'));

        // Highlight table row
        $('.timeline-row').removeClass('active');
        $(`.timeline-row[data-index="${index}"]`).addClass('active');

        // Update map marker position
        const iframe = document.getElementById('map-iframe');
        if (iframe && iframe.contentWindow && iframe.contentWindow.updateCurrentPosition) {
            iframe.contentWindow.updateCurrentPosition(log.latitude, log.longitude);
        }
    },

    move_timeline: function (delta) {
        const newIndex = this.state.currentIndex + delta;
        if (newIndex >= 0 && newIndex < this.state.logs.length) {
            this.set_timeline_position(newIndex);
            $('#timeline-slider').val(newIndex);
        }
    },

    toggle_play: function () {
        const $btn = $('#btn-play');

        if (this.state.isPlaying) {
            // Stop
            clearInterval(this.state.playInterval);
            this.state.isPlaying = false;
            $btn.html('<i class="fa fa-play"></i>');
        } else {
            // Play
            this.state.isPlaying = true;
            $btn.html('<i class="fa fa-pause"></i>');

            // Reset to start if at end
            if (this.state.currentIndex >= this.state.logs.length - 1) {
                this.state.currentIndex = 0;
            }

            this.state.playInterval = setInterval(() => {
                if (this.state.currentIndex < this.state.logs.length - 1) {
                    this.move_timeline(1);
                } else {
                    this.toggle_play(); // Stop at end
                }
            }, 500);
        }
    },

    sync_from_gps: function () {
        if (!this.state.selectedVehicle) {
            frappe.msgprint(__('Please select a vehicle first'));
            return;
        }

        frappe.call({
            method: "paperware.logistics_fleet.doctype.vehicle_location_log.vehicle_location_log.sync_vehicle_history_from_gps",
            args: {
                vehicle: this.state.selectedVehicle,
                date: this.state.selectedDate
            },
            freeze: true,
            freeze_message: __('Syncing GPS History...'),
            callback: (r) => {
                if (r.message && r.message.status === 'success') {
                    frappe.show_alert({
                        message: r.message.message,
                        indicator: 'green'
                    });
                    this.load_history();
                } else {
                    frappe.msgprint(r.message?.message || __('Error syncing GPS data'));
                }
            }
        });
    }
};
