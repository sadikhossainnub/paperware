frappe.pages['communications-dashboard'].on_page_load = function (wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: __('Communications Dashboard'),
        single_column: true
    });

    frappe.communications_dashboard.init(page);
}

frappe.communications_dashboard = {
    state: {
        activeTab: 'messages',
        activeFolder: 'inbox',
        activeChannel: 'all',
        searchQuery: '',
        messages: [
            { id: 1, sender: 'Rahim Ahmed', subject: 'Urgent: Production Delay', time: '10:30 AM', channel: 'WhatsApp', priority: 'Urgent', unread: true, starred: false, folder: 'inbox', snippet: 'Machine #4 is down, we need to adjust the schedule for Paper Box order...' },
            { id: 2, sender: 'Green Packaging Ltd', subject: 'Invoice Payment Confirmation', time: 'Yesterday', channel: 'Email', priority: 'Normal', unread: false, starred: true, folder: 'inbox', snippet: 'We have received the payment of ৳45,000 for Invoice #789...' },
            { id: 3, sender: 'System Notice', subject: 'New Quote Request', time: 'Yesterday', channel: 'Internal', priority: 'High', unread: false, starred: false, folder: 'inbox', snippet: 'A new quotation request has been submitted by AB Textiles...' },
            { id: 4, sender: 'Drivers Group', subject: 'Route update for Zone A', time: '2 days ago', channel: 'SMS', priority: 'Normal', unread: false, starred: false, folder: 'sent', snippet: 'Bridge repair on Main St. Please use the bypass road...' },
            { id: 5, sender: 'Manager Sarah', subject: 'Weekly Team Meeting', time: '3 days ago', channel: 'Internal', priority: 'Normal', unread: false, starred: false, folder: 'drafts', snippet: 'The team meeting is moved to Wednesday at 2pm in Conference Room B...' }
        ],
        notifications: [
            { id: 1, type: 'Order', text: 'New Order #902 received from Apex Footwear', time: '5m ago', priority: 'High', unread: true },
            { id: 2, type: 'Production', text: 'Batch #44 production completed', time: '1h ago', priority: 'Normal', unread: true },
            { id: 3, type: 'Payment', text: 'Payment of ৳12,500 pending from Karim & Sons', time: '3h ago', priority: 'Urgent', unread: true }
        ],
        announcements: [
            { id: 1, title: 'Annual Factory Maintenance', date: 'Jan 30 - Feb 2', pinned: true, dept: 'Production', author: 'Engr. Kamal', read: false },
            { id: 2, title: 'New Safety Protocols for Loading Dock', date: 'Jan 25', pinned: false, dept: 'Logistics', author: 'Safety Dept', read: false }
        ],
        contacts: [
            { id: 1, name: 'Apex Footwear', email: 'orders@apex.com', phone: '01712xxxxxx', company: 'Apex Group', vip: true, last_contact: '2h ago' },
            { id: 2, name: 'BSRM Steel', email: 'supply@bsrm.com', phone: '01811xxxxxx', company: 'BSRM', vip: false, last_contact: '1 day ago' }
        ],
        templates: [
            { id: 1, name: 'Order Confirmation', category: 'Sales', snippet: 'Dear {customer_name}, Thank you for your order #{order_id}...' },
            { id: 2, name: 'Payment Reminder', category: 'Accounts', snippet: 'Payment of ৳{amount} for invoice #{invoice_id} is due...' }
        ],
        calls: [
            { id: 1, name: 'Customer X', time: '10:00 AM', duration: '5:20', type: 'Incoming', status: 'Solved' },
            { id: 2, name: 'Driver Rahim', time: '09:15 AM', duration: '1:45', type: 'Outgoing', status: 'Pending' }
        ]
    },

    init: function (page) {
        this.page = page;
        this.wrapper = $(page.body);
        this.setup_layout();
        this.render_sidebar();
        this.switch_tab('messages');
    },

    setup_layout: function () {
        this.wrapper.html(`
            <div class="communications-dashboard">
                <div class="comm-sidebar"></div>
                <div class="comm-main">
                    <div class="comm-header">
                        <div class="comm-title" id="tab-title">Messages</div>
                        <div class="comm-header-actions" id="header-actions"></div>
                    </div>
                    <div id="tab-content" style="flex: 1; overflow: hidden; display: flex; flex-direction: column;"></div>
                </div>
            </div>
        `);
    },

    render_sidebar: function () {
        const tabs = [
            { id: 'messages', icon: 'fa fa-envelope', label: 'Messages', badge: 1 },
            { id: 'notifications', icon: 'fa fa-bell', label: 'Notifications', badge: 3 },
            { id: 'announcements', icon: 'fa fa-bullhorn', label: 'Announcements' },
            { id: 'templates', icon: 'fa fa-file-text', label: 'Templates' },
            { id: 'contacts', icon: 'fa fa-users', label: 'Contacts' },
            { id: 'calls', icon: 'fa fa-phone', label: 'Call Logs' },
            { id: 'analytics', icon: 'fa fa-bar-chart', label: 'Analytics' }
        ];

        const sidebar = this.wrapper.find('.comm-sidebar');
        sidebar.html(`
            <div class="comm-logo">
                <i class="fa fa-paper-plane"></i>
                <span>COMM HUB</span>
            </div>
            <div class="comm-nav-list">
                ${tabs.map(t => `
                    <div class="comm-nav-item ${t.id === this.state.activeTab ? 'active' : ''}" data-tab="${t.id}">
                        <i class="${t.icon}"></i>
                        <span class="comm-nav-text">${t.label}</span>
                        ${t.badge ? `<span class="comm-nav-badge">${t.badge}</span>` : ''}
                    </div>
                `).join('')}
            </div>
        `);

        sidebar.find('.comm-nav-item').click((e) => {
            const tab = $(e.currentTarget).data('tab');
            this.switch_tab(tab);
        });
    },

    switch_tab: function (tab) {
        this.state.activeTab = tab;
        this.wrapper.find('.comm-nav-item').removeClass('active');
        this.wrapper.find(`[data-tab="${tab}"]`).addClass('active');

        $('#tab-title').text(this.capitalize(tab));
        this.render_header_actions(tab);
        this.render_tab_content(tab);
    },

    render_header_actions: function (tab) {
        const actionsSet = {
            messages: [
                { label: 'Compose', icon: 'fa fa-plus', class: 'comm-btn-primary', action: 'open_compose' },
                { label: 'Refresh', icon: 'fa fa-refresh', action: 'refresh' },
                { label: 'Settings', icon: 'fa fa-cog', action: 'settings' }
            ],
            notifications: [
                { label: 'Mark All Read', icon: 'fa fa-check-double', action: 'mark_all_read' },
                { label: 'Clear All', icon: 'fa fa-trash', action: 'clear_all' }
            ],
            announcements: [
                { label: 'New Announcement', icon: 'fa fa-plus', class: 'comm-btn-primary', action: 'new_announcement' }
            ],
            templates: [
                { label: 'Create Template', icon: 'fa fa-plus', class: 'comm-btn-primary', action: 'create_template' }
            ],
            contacts: [
                { label: 'Add Contact', icon: 'fa fa-user-plus', class: 'comm-btn-primary', action: 'add_contact' },
                { label: 'Export', icon: 'fa fa-download', action: 'export_contacts' }
            ],
            calls: [
                { label: 'Log Call', icon: 'fa fa-plus', action: 'log_call' },
                { label: 'Export', icon: 'fa fa-download', action: 'export_calls' }
            ],
            analytics: [
                { label: 'Export Report', icon: 'fa fa-file-pdf-o', action: 'export_report' }
            ]
        };

        const actions = actionsSet[tab] || [];
        const container = $('#header-actions');
        container.html(actions.map(a => `
            <button class="comm-btn ${a.class || ''}" data-action="${a.action}">
                <i class="${a.icon}"></i>
                <span>${a.label}</span>
            </button>
        `).join(''));

        container.find('.comm-btn').click((e) => {
            const action = $(e.currentTarget).data('action');
            this.handle_action(action);
        });
    },

    render_tab_content: function (tab) {
        const container = $('#tab-content');
        container.empty();

        if (tab === 'messages') {
            this.render_messages(container);
        } else if (tab === 'notifications') {
            this.render_notifications(container);
        } else if (tab === 'announcements') {
            this.render_announcements(container);
        } else if (tab === 'templates') {
            this.render_templates(container);
        } else if (tab === 'contacts') {
            this.render_contacts(container);
        } else if (tab === 'calls') {
            this.render_calls(container);
        } else if (tab === 'analytics') {
            this.render_analytics(container);
        }
    },

    render_messages: function (container) {
        container.html(`
            <div class="comm-content-split">
                <div class="comm-sidebar-mini" style="width: 180px; border-right: 1px solid #eee; background: #fff;">
                    <div style="padding: 15px;">
                        <button class="btn btn-default btn-xs" style="width:100%; margin-bottom:10px;" id="btn-filter-toggle"><i class="fa fa-filter"></i> Filters</button>
                        <div class="comm-folder-list">
                            <div class="comm-folder-item active" data-folder="inbox"><i class="fa fa-inbox"></i> Inbox</div>
                            <div class="comm-folder-item" data-folder="starred"><i class="fa fa-star"></i> Starred</div>
                            <div class="comm-folder-item" data-folder="sent"><i class="fa fa-paper-plane"></i> Sent</div>
                            <div class="comm-folder-item" data-folder="drafts"><i class="fa fa-file-text-o"></i> Drafts</div>
                            <div class="comm-folder-item" data-folder="archived"><i class="fa fa-archive"></i> Archived</div>
                        </div>
                        <hr>
                        <div class="comm-channel-list">
                           <div class="comm-channel-item active" data-channel="all">All Channels</div>
                           <div class="comm-channel-item" data-channel="WhatsApp">WhatsApp</div>
                           <div class="comm-channel-item" data-channel="Email">Email</div>
                           <div class="comm-channel-item" data-channel="SMS">SMS</div>
                           <div class="comm-channel-item" data-channel="Internal">Internal</div>
                        </div>
                    </div>
                </div>
                <div class="comm-list-view">
                    <div class="comm-list-search">
                        <div class="comm-search-box">
                            <i class="fa fa-search"></i>
                            <input type="text" class="comm-search-input" id="msg-search" placeholder="Search messages...">
                        </div>
                    </div>
                    <div class="comm-items-scroll" id="msg-list">
                       <!-- List items go here -->
                    </div>
                </div>
                <div class="comm-detail-view" id="message-detail">
                    <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; color:#9ca3af;">
                        <i class="fa fa-envelope-o" style="font-size: 60px; margin-bottom: 20px;"></i>
                        <p>Select a message to read</p>
                    </div>
                </div>
            </div>
        `);

        this.filter_and_render_msg_list();

        // Bind folder clicks
        container.find('.comm-folder-item').click((e) => {
            const folder = $(e.currentTarget).data('folder');
            this.state.activeFolder = folder;
            container.find('.comm-folder-item').removeClass('active');
            $(e.currentTarget).addClass('active');
            this.filter_and_render_msg_list();
        });

        // Bind channel clicks
        container.find('.comm-channel-item').click((e) => {
            const channel = $(e.currentTarget).data('channel');
            this.state.activeChannel = channel;
            container.find('.comm-channel-item').removeClass('active');
            $(e.currentTarget).addClass('active');
            this.filter_and_render_msg_list();
        });

        // Search binding
        container.find('#msg-search').on('keyup', (e) => {
            this.state.searchQuery = $(e.target).val().toLowerCase();
            this.filter_and_render_msg_list();
        });

        container.find('#btn-filter-toggle').click(() => {
            frappe.show_alert({ message: "Filter options toggled", indicator: 'blue' });
        });
    },

    filter_and_render_msg_list: function () {
        const filtered = this.state.messages.filter(m => {
            const matchFolder = (this.state.activeFolder === 'starred') ? m.starred : (m.folder === this.state.activeFolder);
            const matchChannel = (this.state.activeChannel === 'all') || (m.channel === this.state.activeChannel);
            const matchSearch = m.sender.toLowerCase().includes(this.state.searchQuery) || m.subject.toLowerCase().includes(this.state.searchQuery);
            return matchFolder && matchChannel && matchSearch;
        });

        const $list = $('#msg-list');
        if (filtered.length === 0) {
            $list.html('<div class="text-center p-5 text-muted">No messages found</div>');
            return;
        }

        $list.html(filtered.map(m => `
            <div class="comm-item ${m.unread ? 'unread' : ''}" data-id="${m.id}">
                <div class="comm-item-header">
                    <span class="comm-item-name">${m.sender}</span>
                    <span class="comm-item-time">${m.time}</span>
                </div>
                <div class="comm-item-subject">${m.subject}</div>
                <div class="comm-item-snippet">${m.snippet}</div>
                <div style="margin-top: 8px; display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <span class="status-pill status-${m.priority.toLowerCase()}">${m.priority}</span>
                        <span class="status-pill" style="background:#eee; color:#666;">${m.channel}</span>
                    </div>
                    ${m.starred ? '<i class="fa fa-star" style="color:gold"></i>' : ''}
                </div>
            </div>
        `).join(''));

        $list.find('.comm-item').click((e) => {
            const id = $(e.currentTarget).data('id');
            const msg = this.state.messages.find(x => x.id === id);
            msg.unread = false;
            $(e.currentTarget).removeClass('unread').addClass('active').siblings().removeClass('active');
            this.render_message_detail(id);
        });
    },

    render_message_detail: function (id) {
        const m = this.state.messages.find(x => x.id === id);
        if (!m) return;

        $('#message-detail').html(`
            <div class="comm-detail-header">
                <div class="comm-sender-info">
                    <div class="comm-avatar">${m.sender.split(' ').map(x => x[0]).join('')}</div>
                    <div>
                        <div style="font-weight:700; font-size:16px;">${m.sender}</div>
                        <div style="font-size:12px; color:var(--comm-text-muted);">via ${m.channel} • ${m.time}</div>
                    </div>
                </div>
                <div class="comm-header-actions">
                    <button class="comm-btn" data-detail-action="star" ${m.starred ? 'style="color: gold;"' : ''}><i class="fa fa-star${m.starred ? '' : '-o'}"></i></button>
                    <button class="comm-btn" data-detail-action="archive"><i class="fa fa-archive"></i></button>
                    <button class="comm-btn" data-detail-action="print"><i class="fa fa-print"></i></button>
                    <button class="comm-btn" data-detail-action="delete"><i class="fa fa-trash"></i></button>
                    <button class="comm-btn" data-detail-action="download"><i class="fa fa-download"></i></button>
                </div>
            </div>
            <div class="comm-detail-body">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 20px;">
                    <div style="font-size:18px; font-weight:700;">${m.subject}</div>
                    <button class="btn btn-default btn-xs" data-detail-action="mark_unread">Mark Unread</button>
                </div>
                <div class="comm-message-content">
                    <p>Dear Team,</p>
                    <p>${m.snippet}</p>
                    <p>Please let me know how you want to proceed with this.</p>
                    <p>Regards,<br>${m.sender}</p>
                </div>
                <div style="margin-top: 20px; padding: 15px; border: 1px solid #eee; border-radius: 10px; background: #fbfbfb; display: flex; align-items: center; gap: 15px;">
                    <i class="fa fa-file-pdf-o" style="font-size: 24px; color: #ef4444;"></i>
                    <div style="flex: 1;">
                        <div style="font-weight: 600; font-size: 13px;">Attachment_Invoice_789.pdf</div>
                        <div style="font-size: 11px; color: #999;">2.4 MB</div>
                    </div>
                    <button class="btn btn-default btn-sm" data-detail-action="download">Download</button>
                </div>
                <div style="margin-top: 40px; border-top: 1px solid #eee; padding-top: 20px; display:flex; gap:15px;">
                    <button class="comm-btn comm-btn-primary" data-detail-action="reply"><i class="fa fa-reply"></i> Reply</button>
                    <button class="comm-btn" data-detail-action="forward"><i class="fa fa-share"></i> Forward</button>
                </div>
            </div>
        `);

        $('#message-detail .comm-btn, #message-detail .btn').click((e) => {
            const action = $(e.currentTarget).data('detail-action');
            this.handle_detail_action(action, m);
        });
    },

    render_notifications: function (container) {
        container.html(`
            <div style="padding: 30px; overflow-y: auto;">
                ${this.state.notifications.map(n => `
                    <div class="comm-item ${n.unread ? 'unread' : ''}" style="border-radius:15px; border:1px solid #eee; margin-bottom:15px; display:flex; gap:20px; align-items:center; background:#fff;">
                        <div style="width:50px; height:50px; border-radius:12px; background:#f3f4f6; display:flex; align-items:center; justify-content:center; color:var(--comm-accent);">
                            <i class="fa ${n.type === 'Order' ? 'fa-shopping-cart' : n.type === 'Payment' ? 'fa-money' : 'fa-cog'}"></i>
                        </div>
                        <div style="flex:1">
                            <div style="display:flex; justify-content:space-between;">
                                <span style="font-weight:700;">${n.type} Notification</span>
                                <span class="status-pill status-${n.priority.toLowerCase()}">${n.priority}</span>
                            </div>
                            <div style="font-size:14px; margin-top:5px;">${n.text}</div>
                            <div style="font-size:11px; color:#999; margin-top:5px;">${n.time}</div>
                        </div>
                        <div style="display:flex; gap:10px;">
                            <button class="btn btn-default btn-sm" onclick="frappe.communications_dashboard.handle_action('mark_notif_read', ${n.id})">Mark Read</button>
                            <button class="btn btn-primary btn-sm" onclick="frappe.communications_dashboard.handle_action('take_action', ${n.id})">Take Action</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `);
    },

    render_announcements: function (container) {
        container.html(`
            <div style="padding: 30px; display:grid; grid-template-columns: repeat(2, 1fr); gap: 20px; overflow-y: auto;">
                ${this.state.announcements.map(a => `
                    <div class="comm-stat-card">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                           <div style="color:var(--comm-accent); font-weight:800; font-size:12px;">${a.dept.toUpperCase()}</div>
                           <div style="display:flex; gap:10px;">
                               ${a.pinned ? '<i class="fa fa-thumb-tack" style="color:var(--urgent);"></i>' : ''}
                               <i class="fa fa-ellipsis-v" style="cursor:pointer" onclick="frappe.communications_dashboard.handle_action('more_options')"></i>
                           </div>
                        </div>
                        <div style="font-size:18px; font-weight:700; margin-bottom:10px;">${a.title}</div>
                        <div style="font-size:13px; color:#666; margin-bottom:20px;">By ${a.author} • ${a.date}</div>
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                            <div style="font-size:11px; color:#999;">Read by 65%</div>
                            <div style="font-size:11px; color:#999;">Expires in 2 days</div>
                        </div>
                        <div class="progress" style="height: 6px; margin-bottom: 20px;">
                            <div class="progress-bar bg-warning" style="width: 65%"></div>
                        </div>
                        <button class="comm-btn ${a.read ? '' : 'comm-btn-primary'}" style="width:100%; justify-content:center;" onclick="frappe.communications_dashboard.handle_action('acknowledge', ${a.id})">
                             ${a.read ? '<i class="fa fa-check"></i> Acknowledged' : 'Confirm Receipt'}
                        </button>
                    </div>
                `).join('')}
            </div>
        `);
    },

    render_templates: function (container) {
        container.html(`
            <div style="padding: 30px; display:grid; grid-template-columns: repeat(3, 1fr); gap: 20px; overflow-y: auto;">
                ${this.state.templates.map(t => `
                    <div class="comm-stat-card">
                        <div style="font-weight:800; color:var(--normal); font-size:11px; margin-bottom:10px;">${t.category}</div>
                        <div style="font-weight:700; margin-bottom:10px;">${t.name}</div>
                        <p style="font-size:12px; color:#666; font-style:italic;">"${t.snippet}"</p>
                        <div style="display:flex; gap:10px; margin-top:20px;">
                            <button class="comm-btn" style="flex:1; justify-content:center;" title="Copy to clipboard" onclick="frappe.communications_dashboard.handle_action('copy_tpl', '${escape(t.snippet)}')"><i class="fa fa-copy"></i> Copy</button>
                            <button class="comm-btn" style="flex:1; justify-content:center;" onclick="frappe.communications_dashboard.handle_action('edit_tpl')"><i class="fa fa-edit"></i> Edit</button>
                             <button class="comm-btn comm-btn-primary" style="flex:1; justify-content:center;" onclick="frappe.communications_dashboard.handle_action('use_tpl', ${t.id})"><i class="fa fa-send"></i> Use</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `);
    },

    render_contacts: function (container) {
        container.html(`
            <div style="padding: 20px; overflow-y: auto;">
                <table class="table table-hover" style="background:white; border-radius:15px; overflow:hidden;">
                    <thead>
                        <tr>
                            <th>Contact</th>
                            <th>Company</th>
                            <th>History</th>
                            <th>Last Activity</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.state.contacts.map(c => `
                            <tr>
                                <td>
                                    <div style="display:flex; gap:10px; align-items:center;">
                                        <div class="comm-avatar" style="width:30px; height:30px; font-size:12px;">${c.name[0]}</div>
                                        <div>
                                            <div style="font-weight:700;">${c.name} ${c.vip ? '<span style="color:gold">★</span>' : ''}</div>
                                            <div style="font-size:11px; color:#666;">${c.email}</div>
                                        </div>
                                    </div>
                                </td>
                                <td>${c.company}</td>
                                <td><span class="status-pill status-normal">18 Messages</span></td>
                                <td>${c.last_contact}</td>
                                <td>
                                    <div style="display:flex; gap:5px;">
                                        <button class="btn btn-default btn-xs" title="WhatsApp" onclick="frappe.communications_dashboard.handle_action('whatsapp', '${c.phone}')"><i class="fa fa-whatsapp"></i></button>
                                        <button class="btn btn-default btn-xs" title="Compose Email" onclick="frappe.communications_dashboard.handle_action('email')"><i class="fa fa-envelope-o"></i></button>
                                        <button class="btn btn-default btn-xs" title="Call" onclick="frappe.communications_dashboard.handle_action('call', '${c.phone}')"><i class="fa fa-phone"></i></button>
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `);
    },

    render_calls: function (container) {
        container.html(`
            <div style="padding: 20px; overflow-y: auto;">
                 <table class="table" style="background:white; border-radius:15px; overflow:hidden;">
                    <thead><tr><th>Caller</th><th>Type</th><th>Time</th><th>Duration</th><th>Action</th></tr></thead>
                    <tbody>
                        ${this.state.calls.map(c => `
                            <tr>
                                <td><strong>${c.name}</strong></td>
                                <td>
                                    <i class="fa fa-arrow-${c.type === 'Incoming' ? 'down' : (c.type === 'Missed' ? 'close' : 'up')}" 
                                       style="color:${c.type === 'Incoming' ? 'green' : (c.type === 'Missed' ? 'red' : 'blue')};"></i> 
                                    ${c.type}
                                </td>
                                <td>${c.time}</td>
                                <td>${c.duration}</td>
                                <td>
                                    <div style="display:flex; gap:5px;">
                                        <button class="btn btn-primary btn-xs" onclick="frappe.communications_dashboard.handle_action('call')">Call Back</button>
                                        <button class="btn btn-default btn-xs" onclick="frappe.communications_dashboard.handle_action('add_note')">Add Note</button>
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                 </table>
            </div>
        `);
    },

    render_analytics: function (container) {
        container.html(`
            <div style="overflow-y:auto; flex:1;">
                <div class="comm-stats-grid">
                    <div class="comm-stat-card">
                        <div class="comm-stat-val">1,234</div>
                        <div class="comm-stat-lbl">Total Messages</div>
                    </div>
                    <div class="comm-stat-card">
                        <div class="comm-stat-val" style="color: var(--normal);">94%</div>
                        <div class="comm-stat-lbl">Response Rate</div>
                    </div>
                    <div class="comm-stat-card">
                        <div class="comm-stat-val" style="color: var(--urgent);">2.5h</div>
                        <div class="comm-stat-lbl">Avg Response Time</div>
                    </div>
                    <div class="comm-stat-card">
                        <div class="comm-stat-val" style="color: var(--high);">4.8</div>
                        <div class="comm-stat-lbl">Satisfaction</div>
                    </div>
                </div>
                <div style="padding:0 30px 30px; display:grid; grid-template-columns: 2fr 1fr; gap:20px;">
                    <div class="comm-stat-card">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                             <div style="font-weight:700;">Channel Performance Overview</div>
                             <div style="font-size:11px; color:#999;">Peak: 10:00 AM - 11:00 AM</div>
                        </div>
                        <div style="height:200px; display:flex; align-items:flex-end; gap:20px; justify-content:space-around; padding-bottom:30px; border-bottom:1px solid #eee;">
                            <div style="width:40px; height:80%; background:var(--comm-accent); border-radius:5px 5px 0 0; position:relative;"><span style="position:absolute; top:-25px; width:100%; text-align:center; font-weight:700;">37%</span><span style="position:absolute; bottom:-30px; width:100%; text-align:center; font-size:10px;">WhatsApp</span></div>
                            <div style="width:40px; height:65%; background:var(--normal); border-radius:5px 5px 0 0; position:relative;"><span style="position:absolute; top:-25px; width:100%; text-align:center; font-weight:700;">32%</span><span style="position:absolute; bottom:-30px; width:100%; text-align:center; font-size:10px;">Email</span></div>
                            <div style="width:40px; height:45%; background:var(--comm-sidebar); border-radius:5px 5px 0 0; position:relative;"><span style="position:absolute; top:-25px; width:100%; text-align:center; font-weight:700;">19%</span><span style="position:absolute; bottom:-30px; width:100%; text-align:center; font-size:10px;">Internal</span></div>
                            <div style="width:40px; height:20%; background:#ddd; border-radius:5px 5px 0 0; position:relative;"><span style="position:absolute; top:-25px; width:100%; text-align:center; font-weight:700;">12%</span><span style="position:absolute; bottom:-30px; width:100%; text-align:center; font-size:10px;">SMS/Calls</span></div>
                        </div>
                        <div style="margin-top:20px; display:flex; gap:30px;">
                            <div><small class="text-muted">Response Patterns:</small></div>
                            <div style="font-size:12px;"><i class="fa fa-circle" style="color:var(--comm-accent)"></i> Fast</div>
                            <div style="font-size:12px;"><i class="fa fa-circle" style="color:var(--normal)"></i> Normal</div>
                        </div>
                    </div>
                    <div class="comm-stat-card">
                         <div style="font-weight:700; margin-bottom:10px;">AI Insight 🤖</div>
                         <div style="padding:15px; background:#fff8e1; border-radius:10px; font-size:12px; line-height:1.5; margin-bottom:15px;">
                            <b>Recommendation:</b> Response time for <b>Production</b> messages has increased by 15% this week.
                         </div>
                         <div style="padding:15px; background:#e8f5e9; border-radius:10px; font-size:12px; line-height:1.5;">
                            <b>Efficiency Tip:</b> VIP Customers expect response in &lt;1h. 80% of your targets were met today.
                         </div>
                    </div>
                </div>
            </div>
        `);
    },

    handle_action: function (action, data) {
        const toastMapping = {
            open_compose: "Opening composer...",
            refresh: "Data refreshed",
            settings: "Settings opened",
            mark_all_read: "All notifications marked as read",
            clear_all: "All notifications cleared",
            mark_notif_read: "Notification marked as read",
            take_action: "Action performed on item",
            new_announcement: "Creating new announcement...",
            more_options: "Showing more options",
            acknowledge: "Announcement acknowledged",
            create_template: "Creating new template...",
            edit_tpl: "Template edited",
            copy_tpl: "Template copied to clipboard",
            use_tpl: "Template loaded into composer",
            export_contacts: "Exporting contacts data to CSV...",
            add_contact: "New contact added",
            whatsapp: `Opening WhatsApp chat with ${data || ''}`,
            email: "Compose email modal opened",
            call: `Initiating call to ${data || ''}`,
            log_call: "Manual call log entry added",
            export_calls: "Exporting call logs data...",
            add_note: "Note added to call history",
            export_report: "Exporting analytics data report..."
        };

        if (action === 'open_compose' || action === 'email') {
            this.open_compose_modal();
        } else if (action === 'acknowledge') {
            const a = this.state.announcements.find(x => x.id === data);
            if (a) a.read = true;
            this.render_announcements($('#tab-content'));
        } else if (action === 'use_tpl') {
            const t = this.state.templates.find(x => x.id === data);
            this.open_compose_modal(t.snippet);
        } else if (action === 'copy_tpl') {
            const decoded = unescape(data);
            navigator.clipboard.writeText(decoded);
        }

        const msg = toastMapping[action] || `Action performed: ${action}`;
        const indicator = (action.includes('error') || action.includes('delete')) ? 'red' : 'green';
        frappe.show_alert({ message: __(msg), indicator: (action.includes('export') || action === 'refresh') ? 'blue' : indicator });
    },

    handle_detail_action: function (action, m) {
        if (action === 'star') {
            m.starred = !m.starred;
            frappe.show_alert({ message: m.starred ? __('Message starred') : __('Message unstarred'), indicator: 'yellow' });
            this.render_message_detail(m.id);
            this.filter_and_render_msg_list();
        } else if (action === 'delete') {
            frappe.confirm(__('Are you sure you want to delete this message?'), () => {
                this.state.messages = this.state.messages.filter(x => x.id !== m.id);
                this.switch_tab('messages');
                frappe.show_alert({ message: __('Message deleted'), indicator: 'red' });
            });
        } else if (action === 'archive') {
            m.folder = 'archived';
            this.switch_tab('messages');
            frappe.show_alert({ message: __('Message moved to archive'), indicator: 'orange' });
        } else if (action === 'reply' || action === 'forward') {
            this.open_compose_modal();
            frappe.show_alert({ message: __(action === 'reply' ? "Composing reply..." : "Forward message"), indicator: 'blue' });
        } else if (action === 'print') {
            window.print();
        } else if (action === 'mark_unread') {
            m.unread = true;
            this.switch_tab('messages');
            frappe.show_alert({ message: __('Marked as unread'), indicator: 'blue' });
        } else if (action === 'download') {
            frappe.show_alert({ message: __('Downloading attachment...'), indicator: 'blue' });
        }
    },

    open_compose_modal: function (initial_body = '') {
        const dialog = new frappe.ui.Dialog({
            title: __('Compose New Message'),
            fields: [
                { label: 'Channel', fieldname: 'channel', fieldtype: 'Select', options: 'Email\nWhatsApp\nSMS\nInternal', default: 'Email', reqd: 1 },
                { label: 'Recipient', fieldname: 'to', fieldtype: 'Data', reqd: 1 },
                { label: 'Subject', fieldname: 'subject', fieldtype: 'Data', depends_on: 'eval:doc.channel=="Email" || doc.channel=="Internal"' },
                { label: 'Template', fieldname: 'template', fieldtype: 'Link', options: 'Communication Template' },
                { label: 'Message', fieldname: 'body', fieldtype: 'Small Text', reqd: 1, default: initial_body },
                { label: 'Priority', fieldname: 'priority', fieldtype: 'Select', options: 'Low\nNormal\nHigh\nUrgent', default: 'Normal' },
                { label: 'Attachments', fieldname: 'attach', fieldtype: 'Button', click: () => frappe.show_alert("File picker opened") }
            ],
            primary_action_label: __('Send Message'),
            primary_action: (values) => {
                frappe.show_alert({ message: __('Message sent successfully!'), indicator: 'green' });
                dialog.hide();
            }
        });

        dialog.add_custom_button(__('Save Draft'), () => {
            frappe.show_alert({ message: __('Saved as draft'), indicator: 'blue' });
            dialog.hide();
        });

        dialog.add_custom_button(__('Use Template'), () => {
            frappe.show_alert({ message: __('Template modal opened') });
        });

        dialog.show();
    },

    capitalize: (s) => s.charAt(0).toUpperCase() + s.slice(1)
};
