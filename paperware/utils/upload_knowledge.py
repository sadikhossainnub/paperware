import pandas as pd
import frappe
from openpyxl import load_workbook

def upload_knowledge():
    """
    Reads production costing data from Excel and uploads it to AI Training Knowledge DocType
    """
    # Path to the excel file — resolved dynamically from module location
    file_path = frappe.get_app_path("paperware", "Production Cost Calculator.xlsx")
    
    try:
        # Load the excel file
        df = pd.read_excel(file_path)
        
        # Normalize column names (strip whitespace and newlines)
        df.columns = [col.strip() for col in df.columns]
        
        # Iterate through the rows and create knowledge entries
        count = 0
        for index, row in df.iterrows():
            # Use variables for keys containing newlines to avoid f-string SyntaxError (Python < 3.12)
            # We use the raw column names as they appear in the excel
            
            # We need to find the exact column names from the dataframe
            # Let's use a helper to get value by partial match or the specific name
            def get_val(target_name, default="N/A"):
                for col in df.columns:
                    if target_name.replace('\n', ' ') in col.replace('\n', ' '):
                        return row[col] if pd.notna(row[col]) else default
                return default

            # Extracting values
            fg_item = row.get('FG Item', 'Unknown')
            date = row.get('Date', 'N/A')
            client = row.get('Clint Name', 'N/A')
            paper_item = row.get('Paper Item', 'N/A')
            
            # These specifically had \n in the excel headers
            net_paper_price = get_val('Net Paper Price')
            total_paper_price = get_val('Total Paper Price')
            printing_machine = get_val('Printing Machine')
            total_printing_cost = get_val('Total Printing Cost')
            lamination_type = get_val('Lamination Type')
            total_lamination_cost = get_val('Total Lamination Cost')
            total_die_cost = get_val('Total Die Cost')
            profit_markup = get_val('Profit Markup (%)')
            delivery = row.get('Delivery', 'N/A')

            # Create a descriptive knowledge text
            knowledge_text = f"Production Costing Reference for Item: {fg_item}\n"
            knowledge_text += f"- Date: {date}\n"
            knowledge_text += f"- Client: {client}\n"
            knowledge_text += f"- Paper Item: {paper_item}\n"
            knowledge_text += f"- Net Paper Price: {net_paper_price}\n"
            knowledge_text += f"- Total Paper Price: {total_paper_price}\n"
            knowledge_text += f"- Printing Machine: {printing_machine}\n"
            knowledge_text += f"- Total Printing Cost: {total_printing_cost}\n"
            knowledge_text += f"- Lamination Type: {lamination_type}\n"
            knowledge_text += f"- Total Lamination Cost: {total_lamination_cost}\n"
            knowledge_text += f"- Total Die Cost: {total_die_cost}\n"
            knowledge_text += f"- Delivery Cost: {delivery}\n"
            knowledge_text += f"- Profit Markup (%): {profit_markup}"

            # Create AI Training Knowledge document
            doc = frappe.get_doc({
                "doctype": "AI Training Knowledge",
                "title": f"Costing Reference: {fg_item}",
                "knowledge_text": knowledge_text,
                "category": "Costing Rule",
                "source": "Production Cost Calculator Excel"
            })
            doc.insert()
            count += 1
            
        frappe.db.commit()
        return f"Successfully uploaded {count} costing reference entries to AI Training Knowledge."
        
    except Exception as e:
        return f"Error uploading knowledge: {str(e)}"