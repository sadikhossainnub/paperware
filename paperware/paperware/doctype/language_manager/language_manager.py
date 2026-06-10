# Copyright (c) 2026, Sayed and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document

class LanguageManager(Document):
	pass

@frappe.whitelist()
def get_translations(lang="bn"):
	"""Get all translations for a specific language"""
	translations = frappe.get_all("Language Manager", fields=["translation_key", "english_text", "bengali_text"])
	result = {}
	for t in translations:
		if lang == "bn":
			result[t.translation_key] = t.bengali_text or t.english_text
		else:
			result[t.translation_key] = t.english_text
			
	return result
