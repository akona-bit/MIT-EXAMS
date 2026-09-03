import json
import os

log_path = r"C:\Users\LENOVO\.gemini\antigravity-ide\brain\d9230596-e060-4ebd-9d58-f4023597c3d1\.system_generated\logs\transcript_full.jsonl"
data_dir = r"d:\MIT\data"

def extract():
    with open(log_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
        
    for line in reversed(lines):
        step = json.loads(line)
        if step.get('type') == 'USER_INPUT':
            content = step.get('content', '')
            if "MaDe;Cau1;" in content:
                text_lines = content.split('\n')
                ans_lines = []
                sub_lines = []
                mode = 0
                for r in text_lines:
                    if r.startswith("MaDe;Cau1;"):
                        mode = 1
                    elif r.startswith("SBD,Timestamp,Email"):
                        mode = 2
                        
                    if mode == 1 and r.strip() and not r.startswith("SBD,Timestamp,Email"):
                        ans_lines.append(r.strip())
                    elif mode == 2 and r.strip():
                        if r.startswith("<EPHEMERAL_MESSAGE>"):
                            break
                        sub_lines.append(r.strip())
                        
                # Clean up if EPHEMERAL_MESSAGE or other tags got in
                sub_lines = [l for l in sub_lines if not l.startswith("<") and not l.startswith("The following is")]
                        
                os.makedirs(data_dir, exist_ok=True)
                with open(os.path.join(data_dir, "keys.csv"), "w", encoding="utf-8") as out1:
                    out1.write("\n".join(ans_lines))
                with open(os.path.join(data_dir, "submissions.csv"), "w", encoding="utf-8") as out2:
                    out2.write("\n".join(sub_lines))
                print(f"Extracted {len(ans_lines)} keys and {len(sub_lines)} submissions.")
                break

if __name__ == "__main__":
    extract()
