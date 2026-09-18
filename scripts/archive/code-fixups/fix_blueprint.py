import sys

def fix_file(input_path, output_path):
    with open(input_path, 'rb') as f:
        content = f.read()
    
    try:
        broken_str = content.decode('utf-8')
        
        # Some characters might not map cleanly if the file was edited AFTER corruption.
        # We'll use 'cp1252' with fallback to 'latin-1' or ignore/replace to handle edge cases.
        def safe_encode_cp1252(text):
            res = bytearray()
            for char in text:
                try:
                    res.extend(char.encode('cp1252'))
                except UnicodeEncodeError:
                    # Fallback if character isn't in cp1252
                    try:
                        res.extend(char.encode('latin-1'))
                    except:
                        res.extend(char.encode('utf-8'))
            return bytes(res)

        original_bytes = safe_encode_cp1252(broken_str)
        
        fixed_str = original_bytes.decode('utf-8', errors='replace')
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(fixed_str)
        print("Success! File recovered.")
    except Exception as e:
        print(f"Error: {e}")

fix_file(r'G:\My Drive\AI project\My Porfolio\blue print\ATS_3.0_UI_Modernization_Blueprint.md', r'C:\Users\trith\ats-web\recovered_blueprint.md')
