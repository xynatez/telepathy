import os

def list_all_files_from_current():
    start_path = os.getcwd()
    print(f"📂 Root Folder: {start_path}\n")

    for root, dirs, files in os.walk(start_path):
        level = root.replace(start_path, '').count(os.sep)
        indent = '  ' * level
        print(f"{indent}📁 {os.path.basename(root) or root}")
        sub_indent = '  ' * (level + 1)
        for f in files:
            print(f"{sub_indent}📄 {f}")

list_all_files_from_current()
