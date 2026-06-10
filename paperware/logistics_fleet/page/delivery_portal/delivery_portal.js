frappe.pages['delivery-portal'].on_page_load = function (wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: __('Delivery Team Portal'),
        single_column: true
    });

    frappe.delivery_portal.init(page);
}

frappe.delivery_portal = {
    state: {
        speed: 45,
        streak: 12,
        points: 847,
        rank: 3,
        earnings: {
            base: 1400,
            commission: 350,
            bonus: 200,
            deductions: 0
        },
        chat_messages: [],
        room_name: null,
        manager_id: 'Administrator', // Default Manager ID
        tasks: [
            { id: 'DEL-001', customer: 'Abdur Rahim', status: 'Pending', phone: '01712345678', location: 'Uttara, Sector 4' },
            { id: 'DEL-002', customer: 'Karim Ullah', status: 'Pending', phone: '01812345678', location: 'Mirpur 10' }
        ]
    },

    init: function (page) {
        this.page = page;
        this.$container = $('<div class="delivery-portal">').appendTo(page.main);

        this.render_header();
        this.render_dashboard();
        this.render_quick_actions();
        this.render_active_tasks();

        this.start_simulations();
        this.setup_chat();
    },

    render_header: function () {
        const h_html = `
            <div class="portal-header-actions">
                <button class="header-btn chat" data-action="open_chat">
                    <i class="fa fa-comments"></i>
                    <span class="badge-count">2</span>
                </button>
                <button class="header-btn earnings" data-action="open_earnings">
                    <i class="fa fa-wallet"></i>
                </button>
                <button class="header-btn achievements" data-action="open_achievements">
                    <i class="fa fa-trophy"></i>
                    <span class="badge-count" style="background: #f59e0b; border:none; top:0; right:0;">🔥</span>
                </button>
                <button class="header-btn emergency" data-action="open_emergency">
                    <i class="fa fa-phone"></i>
                </button>
            </div>
        `;
        this.$header = $(h_html).appendTo(this.$container);
        this.bind_header_events();
    },

    render_dashboard: function () {
        const d_html = `
            <div class="dashboard-grid">
                <div class="game-card streak-card" data-action="open_achievements">
                    <i class="fa fa-fire"></i>
                    <div class="card-val">${this.state.streak}</div>
                    <div class="card-lbl">Streak Days</div>
                </div>
                <div class="game-card points-card" data-action="open_achievements">
                    <i class="fa fa-star"></i>
                    <div class="card-val">${this.state.points}</div>
                    <div class="card-lbl">Reward Points</div>
                </div>
                <div class="game-card speed-card" id="speed-meter">
                    <i class="fa fa-tachometer"></i>
                    <div class="card-val"><span id="live-speed">${this.state.speed}</span> <small>km/h</small></div>
                    <div class="card-lbl">Real-time Speed</div>
                </div>
                <div class="game-card rank-card" data-action="open_leaderboard">
                    <i class="fa fa-list-ol"></i>
                    <div class="card-val">#${this.state.rank}</div>
                    <div class="card-lbl">Leaderboard Rank</div>
                </div>
            </div>
        `;
        $(d_html).appendTo(this.$container);
    },

    render_quick_actions: function () {
        const q_html = `
            <div class="quick-actions-section">
                <div class="section-title">${__('Quick Access')}</div>
                <div class="action-grid">
                    <a href="#" class="action-btn training-btn" data-action="open_training">
                        <i class="fa fa-book"></i> ${__('প্রশিক্ষণ')}
                    </a>
                    <a href="#" class="action-btn emergency-grid-btn" data-action="open_emergency">
                        <i class="fa fa-phone"></i> ${__('জরুরি')}
                    </a>
                    <a href="#" class="action-btn earnings-btn" data-action="open_earnings">
                        <i class="fa fa-money"></i> ${__('আজকের আয়')}
                    </a>
                    <a href="#" class="action-btn rewards-btn" data-action="open_achievements">
                        <i class="fa fa-trophy"></i> ${__('অর্জনসমূহ')}
                    </a>
                </div>
            </div>
        `;
        $(q_html).appendTo(this.$container);
        this.bind_action_events();
    },

    render_active_tasks: function () {
        const t_html = `
            <div class="tasks-section" style="padding: 15px;">
                <div class="section-title">${__('Active Deliveries')}</div>
                <div id="active-tasks-list">
                    ${this.state.tasks.map(t => `
                        <div class="game-card" style="align-items: flex-start; text-align: left; margin-bottom: 15px; width: 100%;">
                            <div style="display: flex; justify-content: space-between; width: 100%;">
                                <div style="font-weight: 700;">${t.id}</div>
                                <span class="indicator blue">${t.status}</span>
                            </div>
                            <div style="margin-top: 10px; font-size: 14px;"><strong>${t.customer}</strong></div>
                            <div style="font-size: 12px; color: #666;"><i class="fa fa-map-marker"></i> ${t.location}</div>
                            <div style="display: flex; gap: 10px; margin-top: 15px; width: 100%;">
                                <button class="btn btn-primary btn-sm" style="flex:1" onclick="frappe.delivery_portal.complete_task('${t.id}')">সম্পন্ন</button>
                                <button class="btn btn-danger btn-sm" style="flex:1" onclick="frappe.delivery_portal.fail_task_modal('${t.id}')">ব্যর্থ</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        $(t_html).appendTo(this.$container);
    },

    bind_header_events: function () {
        this.$header.find('[data-action="open_chat"]').click(() => this.open_chat_modal());
        this.$header.find('[data-action="open_earnings"]').click(() => this.open_earnings_modal());
        this.$header.find('[data-action="open_achievements"]').click(() => this.open_achievements_modal());
        this.$header.find('[data-action="open_emergency"]').click(() => this.open_emergency_modal());
    },

    bind_action_events: function () {
        this.$container.find('[data-action="open_training"]').click(() => this.open_training_modal());
        this.$container.find('[data-action="open_leaderboard"]').click(() => this.open_leaderboard_modal());
    },

    // Simulations
    start_simulations: function () {
        // Real-time speed simulation
        setInterval(() => {
            const current_speed = 30 + Math.floor(Math.random() * 50);
            this.state.speed = current_speed;
            $('#live-speed').text(current_speed);

            if (current_speed > 60) {
                $('#speed-meter').addClass('speed-warning');
            } else {
                $('#speed-meter').removeClass('speed-warning');
            }
        }, 5000);
    },

    // Modals
    open_chat_modal: function () {
        const dialog = new frappe.ui.Dialog({
            title: __('Manager Chat'),
            fields: []
        });

        const chat_html = `
            <div class="chat-container">
                <div class="chat-messages" id="chat-msgs">
                    <div class="text-center text-muted" style="padding:20px;">Loading messages...</div>
                </div>
                <div class="chat-input-area">
                    <input type="text" class="form-control" id="chat-input" placeholder="Type message...">
                    <button class="btn btn-primary" id="btn-chat-send"><i class="fa fa-paper-plane"></i></button>
                </div>
            </div>
        `;

        dialog.$wrapper.find('.modal-content').css({
            'border-radius': '20px',
            'overflow': 'hidden'
        });
        dialog.$wrapper.find('.modal-header').addClass('chat-header');
        dialog.$wrapper.find('.modal-body').html(chat_html);

        this.$chat_msgs = dialog.$wrapper.find('#chat-msgs');
        const $input = dialog.$wrapper.find('#chat-input');
        const $send = dialog.$wrapper.find('#btn-chat-send');

        // Load initial messages
        this.load_chat_messages();

        // Subscribe to Realtime events
        if (this.state.room_name) {
            frappe.realtime.on(this.state.room_name, (data) => {
                if (data.room === this.state.room_name) {
                    this.append_message(data);
                }
            });
        }

        const send_msg = () => {
            const val = $input.val();
            if (!val) return;

            if (!this.state.room_name) {
                frappe.msgprint(__('Chat room not connected. Please try again later.'));
                return;
            }

            frappe.call({
                method: 'chat.api.message.send',
                args: {
                    content: val,
                    user: frappe.session.user_fullname,
                    room: this.state.room_name,
                    email: frappe.session.user
                },
                callback: (r) => {
                    // Message sent, waiting for realtime or optimistic update
                    $input.val('');
                }
            });
        };

        $send.click(send_msg);
        $input.on('keypress', (e) => { if (e.which === 13) send_msg(); });

        dialog.show();
        dialog.onhide = () => {
            if (this.state.room_name) {
                frappe.realtime.off(this.state.room_name);
            }
        };
    },

    setup_chat: function () {
        if (frappe.session.user === this.state.manager_id) return;

        frappe.call({
            method: 'chat.api.room.get',
            args: { email: frappe.session.user },
            callback: (r) => {
                if (r.message) {
                    const room = r.message.find(r => r.type === 'Direct' && (r.members.includes(this.state.manager_id)));
                    if (room) {
                        this.state.room_name = room.name;
                    } else {
                        this.create_chat_room();
                    }
                }
            }
        });
    },

    create_chat_room: function () {
        frappe.call({
            method: 'chat.api.room.create_private',
            args: {
                room_name: 'Manager Chat',
                users: JSON.stringify([this.state.manager_id]),
                type: 'Direct'
            },
            callback: (r) => {
                setTimeout(() => this.setup_chat(), 1000);
            }
        });
    },

    load_chat_messages: function () {
        if (!this.state.room_name) {
            this.$chat_msgs.html('<div class="text-center text-muted" style="padding:20px;">Connecting to chat server...</div>');
            return;
        }

        frappe.call({
            method: 'chat.api.message.get_all',
            args: { room: this.state.room_name, email: frappe.session.user },
            callback: (r) => {
                this.$chat_msgs.empty();
                if (r.message && r.message.length) {
                    r.message.forEach(m => this.append_message(m));
                } else {
                    this.$chat_msgs.html('<div class="text-center text-muted" style="padding:20px;">Start a conversation with your Manager.</div>');
                }
                this.$chat_msgs.scrollTop(this.$chat_msgs[0].scrollHeight);
            }
        });
    },

    append_message: function (data) {
        // data structure: { content, sender, creation, sender_email, user (alias for sender in some events) }
        // standardized:
        const sender_email = data.sender_email;
        const message = data.content;
        const time = comment_when(data.creation);
        const is_me = sender_email === frappe.session.user;

        // Remove 'empty' or 'connecting' placeholders if present
        if (this.$chat_msgs.find('.text-muted').length) {
            this.$chat_msgs.empty();
        }

        const msg_html = `
            <div class="message ${is_me ? 'you' : 'manager'}">
                <div class="msg-bubble">${message}</div>
                <div class="msg-meta">${time}</div>
            </div>
        `;

        this.$chat_msgs.append(msg_html);
        this.$chat_msgs.scrollTop(this.$chat_msgs[0].scrollHeight);
    },

    open_earnings_modal: function () {
        const total = this.state.earnings.base + this.state.earnings.commission + this.state.earnings.bonus - this.state.earnings.deductions;
        const e_html = `
            <div class="earnings-summary">
                <div class="total-amt">৳${total}</div>
                <div class="stat-lbl">${__('Total Earnings Today')}</div>
                <div class="progress" style="height: 8px; margin-top: 20px;">
                    <div class="progress-bar bg-success" style="width: 75%"></div>
                </div>
                <div style="font-size: 11px; margin-top: 5px; color: #666;">Target: ৳2000</div>
                
                <div class="earnings-breakdown">
                    <div class="breakdown-card">
                        <div class="val">৳${this.state.earnings.base}</div>
                        <div class="lbl">বেস বেতন</div>
                    </div>
                    <div class="breakdown-card">
                        <div class="val">৳${this.state.earnings.commission}</div>
                        <div class="lbl">কমিশন</div>
                    </div>
                    <div class="breakdown-card">
                        <div class="val">৳${this.state.earnings.bonus}</div>
                        <div class="lbl">বোনাস</div>
                    </div>
                    <div class="breakdown-card" style="border: 1px dashed #ef4444;">
                        <div class="val" style="color:#ef4444">- ৳${this.state.earnings.deductions}</div>
                        <div class="lbl">কাটা</div>
                    </div>
                </div>
            </div>
        `;

        const dialog = new frappe.ui.Dialog({ title: __('Daily Earnings') });
        dialog.$wrapper.find('.modal-header').addClass('earnings-header');
        dialog.$wrapper.find('.modal-body').html(e_html);
        dialog.show();
    },

    open_achievements_modal: function () {
        const a_html = `
            <div style="padding: 10px;">
                <div class="game-card" style="background: var(--achievement-gradient); color: white; margin-bottom: 20px;">
                    <i class="fa fa-star" style="color: gold; font-size: 40px;"></i>
                    <div class="card-val" style="color: white;">${this.state.points} Points</div>
                    <div class="card-lbl" style="color: #e5e7eb;">Level 5 Driver</div>
                </div>
                <div class="section-title">বদনসমূহ (Badges)</div>
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
                    <div class="game-card" style="padding: 10px;">🌟<div style="font-size: 9px; margin-top:5px;">Star Performer</div></div>
                    <div class="game-card" style="padding: 10px;">⚡<div style="font-size: 9px; margin-top:5px;">Speed Demon</div></div>
                    <div class="game-card" style="padding: 10px; opacity: 0.5;">🔒<div style="font-size: 9px; margin-top:5px;">Target Master</div></div>
                </div>
            </div>
        `;
        const dialog = new frappe.ui.Dialog({ title: __('Achievements') });
        dialog.$wrapper.find('.modal-header').addClass('achievements-header');
        dialog.$wrapper.find('.modal-body').html(a_html);
        dialog.show();
    },

    open_emergency_modal: function () {
        const em_html = `
            <div style="padding: 10px;">
                <a href="tel:999" class="action-btn emergency-grid-btn" style="margin-bottom: 15px; justify-content: center;">
                    <i class="fa fa-phone"></i> National Help (999)
                </a>
                <a href="tel:1234567" class="action-btn training-btn" style="margin-bottom: 15px; justify-content: center;">
                    <i class="fa fa-user"></i> Office Manager
                </a>
                <a href="tel:1234567" class="action-btn earnings-btn" style="margin-bottom: 15px; justify-content: center;">
                    <i class="fa fa-wrench"></i> Mechanic Service
                </a>
            </div>
        `;
        const dialog = new frappe.ui.Dialog({ title: __('Emergency Contacts') });
        dialog.$wrapper.find('.modal-header').addClass('emergency-header');
        dialog.$wrapper.find('.modal-body').html(em_html);
        dialog.show();
    },

    open_leaderboard_modal: function () {
        const l_html = `
            <div class="leaderboard-list">
                <div class="leader-item">
                    <div class="rank-badge">🥇</div>
                    <div style="flex:1">Abdullah Al Mamun</div>
                    <div class="card-val" style="font-size: 14px;">1250 pts</div>
                </div>
                <div class="leader-item">
                    <div class="rank-badge">🥈</div>
                    <div style="flex:1">Sabbir Hossain</div>
                    <div class="card-val" style="font-size: 14px;">1100 pts</div>
                </div>
                <div class="leader-item current-user">
                    <div class="rank-badge">3</div>
                    <div style="flex:1">You (Abu Sayed)</div>
                    <div class="card-val" style="font-size: 14px;">${this.state.points} pts</div>
                </div>
            </div>
        `;
        const dialog = new frappe.ui.Dialog({ title: __('Leaderboard') });
        dialog.$wrapper.find('.modal-header').addClass('achievements-header');
        dialog.$wrapper.find('.modal-body').html(l_html);
        dialog.show();
    },

    open_training_modal: function () {
        const t_html = `
            <div style="padding: 10px;">
                <div class="game-card" style="align-items: flex-start; text-align: left; margin-bottom: 15px;">
                    <div style="font-weight: 700;">নিরাপদ ড্রাইভিং টিপস</div>
                    <div style="font-size: 12px; color: #666; margin-top:5px;">Duration: 8:30 min</div>
                    <button class="btn btn-default btn-xs" style="margin-top: 10px;">🎥 Watch Video</button>
                </div>
                <div class="game-card" style="align-items: flex-start; text-align: left;">
                    <div style="font-weight: 700;">কাস্টমার সেবা ম্যানুয়াল</div>
                    <div style="font-size: 12px; color: #666; margin-top:5px;">Duration: 5:15 min</div>
                    <button class="btn btn-default btn-xs" style="margin-top: 10px;">🎥 Watch Video</button>
                </div>
            </div>
        `;
        const dialog = new frappe.ui.Dialog({ title: __('Training') });
        dialog.$wrapper.find('.modal-header').addClass('training-header');
        dialog.$wrapper.find('.modal-body').html(t_html);
        dialog.show();
    },

    fail_task_modal: function (tid) {
        const dialog = new frappe.ui.Dialog({
            title: __('ডেলিভারি ব্যর্থ রেকর্ড'),
            fields: [
                {
                    label: 'Reason', fieldname: 'reason', fieldtype: 'Select',
                    options: 'গ্রাহক উপস্থিত ছিল না\nভুল ঠিকানা\nপেমেন্ট সমস্যা\nপণ্য ক্ষতিগ্রস্ত\nগ্রাহক প্রত্যাখ্যান করেছে\nঅন্যান্য',
                    reqd: 1
                },
                { label: 'Notes', fieldname: 'notes', fieldtype: 'Small Text' }
            ],
            primary_action_label: __('Submit'),
            primary_action: (values) => {
                frappe.show_alert({ message: __('Failed delivery recorded for ') + tid, indicator: 'red' });
                dialog.hide();
            }
        });
        dialog.show();
    },

    complete_task: function (tid) {
        frappe.confirm(__('Are you sure you completed the delivery for ') + tid + '?', () => {
            // Simulate point/earning increase
            this.state.points += 50;
            this.state.earnings.commission += 50;
            this.state.tasks = this.state.tasks.filter(t => t.id !== tid);

            // Refresh UI
            this.$container.empty();
            this.init(this.page);

            frappe.show_alert({ message: __('Delivery completed! +50 Points'), indicator: 'green' });
        });
    }
};
