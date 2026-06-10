app_name = "paperware"
app_title = "Paperware"
app_publisher = "Abu Sayed"
app_description = "Pre-costing system for paper and packaging products"
app_email = "sayedtkg@gmail.com"
app_license = "mit"

# Required apps - paperware app-এর rate cards reuse করব
required_apps = ["paperware"]

# Fixtures - install-এর সময় default data
fixtures = [
    {
        "doctype": "Pre Costing Settings",
        "filters": [["name", "=", "Pre Costing Settings"]]
    }
]

# No scheduler needed for now
# scheduler_events = {}
