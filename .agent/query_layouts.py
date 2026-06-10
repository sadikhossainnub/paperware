import frappe
frappe.init(site='paperware')
frappe.connect()

layouts = frappe.get_all('Paper Cup Layout', fields=['*'])
for l in layouts:
    print(l.name, l.cup_wall_type, "Outer Output=", l.get("outer_output_per_sheet"), "Inner Output=", l.get("output_per_sheet"), "sw=", l.outer_main_sheet_w, "sh=", l.outer_main_sheet_h, "pw=", l.outer_paper_w, "ph=", l.outer_paper_h)
