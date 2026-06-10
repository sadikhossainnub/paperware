import json, os

# Resolve path dynamically from this script's location
_THIS_DIR = os.path.dirname(os.path.abspath(__file__))
file_path = os.path.join(_THIS_DIR, "client_meeting.json")

with open(file_path, 'r') as f:
    data = json.load(f)

start_time_field = {
    "fieldname": "meeting_start_time",
    "fieldtype": "Datetime",
    "label": "Actual Start Time",
    "read_only": 1
}

end_time_field = {
    "fieldname": "meeting_end_time",
    "fieldtype": "Datetime",
    "label": "Actual End Time",
    "read_only": 1
}

existing_fields = [f['fieldname'] for f in data['fields']]
if "meeting_start_time" not in existing_fields:
    data['fields'].append(start_time_field)
if "meeting_end_time" not in existing_fields:
    data['fields'].append(end_time_field)

if "meeting_start_time" not in data['field_order']:
    try:
        idx = data['field_order'].index('duration')
        data['field_order'].insert(idx + 1, 'meeting_start_time')
        data['field_order'].insert(idx + 2, 'meeting_end_time')
    except ValueError:
        data['field_order'].append('meeting_start_time')
        data['field_order'].append('meeting_end_time')

with open(file_path, 'w') as f:
    json.dump(data, f, indent=4)
