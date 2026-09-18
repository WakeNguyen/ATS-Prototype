import sys

def fix_file(input_path, output_path):
    with open(input_path, 'rb') as f:
        content = f.read()
    
    try:
        broken_str = content.decode('utf-8')
        
        # Try to reverse the cp1252 double encoding
        res = bytearray()
        for char in broken_str:
            try:
                res.extend(char.encode('cp1252'))
            except UnicodeEncodeError:
                try:
                    res.extend(char.encode('latin-1'))
                except:
                    # If it's a character that was added AFTER corruption and is natively UTF-8, 
                    # we just convert it directly. (e.g. emoji)
                    res.extend(char.encode('utf-8'))
                    
        fixed_str = bytes(res).decode('utf-8', errors='replace')
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(fixed_str)
        print(f"Success! {input_path} recovered to {output_path}")
    except Exception as e:
        print(f"Error: {e}")

fix_file(r'G:\My Drive\AI project\ATS\ATS 3.0\roll back\DEVELOPMENT_LOG (1).md', r'G:\My Drive\AI project\ATS\ATS 3.0\roll back\DEVELOPMENT_LOG_FIXED.md')
fix_file(r'G:\My Drive\AI project\ATS\ATS 3.0\roll back\ATS_3.0_UI_Modernization_Blueprint.md', r'G:\My Drive\AI project\ATS\ATS 3.0\roll back\BLUEPRINT_FIXED.md')
