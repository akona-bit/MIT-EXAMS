import csv

def generate_blueprint():
    rows = list(csv.DictReader(open('d:\\MIT\\DGNL_Matrix.csv', encoding='utf-8-sig')))
    
    slots = []
    
    # We need to resolve fractional counts. 
    # A1.3.1: 2.5 -> 2, A1.5.1: 2.5 -> 3
    # A2.1.1: 1.5 -> 1, A2.3.1: 0.5 -> 1
    # B2.1.3: 2.5 -> 2, B2.1.5: 1.5 -> 2
    
    fraction_map = {
        'A1.3.1': 2,
        'A1.5.1': 3,
        'A2.1.1': 1,
        'A2.3.1': 1,
        'B2.1.3': 2,
        'B2.1.5': 2
    }
    
    for row in rows:
        code = row['Mã']
        topic = row['Kiến thức']
        concept = row['']
        count_str = row['Số lượng']
        note = row['Ghi chú']
        
        if count_str.strip() == '':
            continue
            
        count = float(count_str)
        if code in fraction_map:
            count = fraction_map[code]
        else:
            count = int(count)
            
        # Determine Part
        if code.startswith('A'): part = 1
        elif code.startswith('B'): part = 2
        elif code.startswith('C'): part = 3
        elif code.startswith('D'): part = 4
        else: part = 1
        
        # Determine Passage and Group
        passage = False
        group = False
        group_id_str = "None"
        
        # Tiếng Việt Đọc hiểu văn bản thông tin (A3)
        if code.startswith('A3.'):
            passage = True
            group = True
            group_id_str = f'"{code[:4]}"' # e.g. "A3.1"
            
        # Tiếng Anh Đọc hiểu (B2)
        if code.startswith('B2.'):
            passage = True
            group = True
            group_id_str = f'"{code[:4]}"'
            
        # Toán and TDKH shuffle groups (C and D)
        shuffle_group = "None"
        if part == 3:
            # C1, C2, C3
            if code.startswith('C1.1') or code.startswith('C1.2'): shuffle_group = 1
            elif code.startswith('C1.3') or code.startswith('C1.4'): shuffle_group = 1
            elif code.startswith('C1.5') or code.startswith('C1.6'): shuffle_group = 1
            elif code.startswith('C2'): shuffle_group = 2
            elif code.startswith('C3'): shuffle_group = 3
        
        node_hint = concept if concept else topic
        if not node_hint:
            node_hint = "Tri thức ngữ văn khác"
            
        slots.append({
            'part': part,
            'count': count,
            'label': f"{topic} - {concept}".strip(" -"),
            'node_hint': node_hint,
            'passage': passage,
            'group': group,
            'group_id_str': group_id_str,
            'order_locked': part == 4, # TDKH is strictly ordered
            'shuffle_group': shuffle_group,
            'note': note.replace('\n', ' ')
        })

    # Generate Python code
    out = []
    out.append('from dataclasses import dataclass')
    out.append('from typing import Dict, List, Optional')
    out.append('')
    out.append('@dataclass(frozen=True)')
    out.append('class BlueprintSlot:')
    out.append('    part: int')
    out.append('    position: int')
    out.append('    count: int')
    out.append('    label: str')
    out.append('    node_hint: str')
    out.append('    passage: bool = False')
    out.append('    group: bool = False')
    out.append('    order_locked: bool = False')
    out.append('    shuffle_group: Optional[int] = None')
    out.append('    note: str = ""')
    out.append('    group_prefix: Optional[str] = None')
    out.append('')
    out.append('    @property')
    out.append('    def key(self) -> str:')
    out.append('        return f"p{self.part}s{self.position}"')
    out.append('')
    out.append('PART_NAMES: Dict[int, str] = {')
    out.append('    1: "Sử dụng ngôn ngữ — Tiếng Việt",')
    out.append('    2: "Sử dụng ngôn ngữ — Tiếng Anh",')
    out.append('    3: "Toán học",')
    out.append('    4: "Tư duy khoa học",')
    out.append('}')
    out.append('')
    out.append('BLUEPRINT_SLOTS: List[BlueprintSlot] = [')
    
    pos_counters = {1: 1, 2: 1, 3: 1, 4: 1}
    for s in slots:
        pos = pos_counters[s['part']]
        pos_counters[s['part']] += 1
        
        line = f"    BlueprintSlot({s['part']}, {pos}, {s['count']}, {repr(s['label'])}, {repr(s['node_hint'])}, passage={s['passage']}, group={s['group']}, order_locked={s['order_locked']}, shuffle_group={s['shuffle_group']}, note={repr(s['note'])}, group_prefix={s['group_id_str']}),"
        out.append(line)
        
    out.append(']')
    out.append('')
    out.append('SCIENCE_FIELD_ORDER: List[str] = ["Hóa học", "Vật lý", "Sinh học", "Khoa học xã hội", "Lịch sử", "Tình huống ứng dụng"]')
    out.append('VALID_BLOCK_SIZES = {1, 2, 3, 5, 7, 8, 12}')
    out.append('')
    out.append('''def get_blueprint() -> dict:
    parts: List[dict] = []
    lo = 1
    for part in (1, 2, 3, 4):
        slots = sorted((s for s in BLUEPRINT_SLOTS if s.part == part), key=lambda s: s.position)
        p_total = sum(s.count for s in slots)
        hi = lo + p_total - 1
        parts.append({
            "part": part,
            "name": PART_NAMES[part],
            "total": p_total,
            "question_range": f"{lo}-{hi}",
            "slots": [
                {
                    "key": s.key,
                    "position": s.position,
                    "count": s.count,
                    "label": s.label,
                    "node_hint": s.node_hint,
                    "passage": s.passage,
                    "group": s.group,
                    "order_locked": s.order_locked,
                    "shuffle_group": s.shuffle_group,
                    "note": s.note,
                    "group_prefix": s.group_prefix,
                }
                for s in slots
            ],
        })
        lo += p_total
    return {
        "total_questions": sum(s.count for s in BLUEPRINT_SLOTS),
        "total_slots": len(BLUEPRINT_SLOTS),
        "duration_minutes": 150,
        "score_scale": "0-300/phần, tổng 0-1200",
        "science_field_order": SCIENCE_FIELD_ORDER,
        "valid_block_sizes": sorted(VALID_BLOCK_SIZES),
        "parts": parts,
    }

def _normalize(name: str) -> str:
    return "".join(str(name).lower().split())

def match_nodes(nodes: List[dict]) -> Dict[str, Optional[int]]:
    by_exact: Dict[str, int] = {}
    for n in nodes:
        by_exact.setdefault(_normalize(n["name"]), n["id"])

    result: Dict[str, Optional[int]] = {}
    for slot in BLUEPRINT_SLOTS:
        target = _normalize(slot.node_hint)
        node_id: Optional[int] = by_exact.get(target)
        if node_id is None:
            for norm, nid in by_exact.items():
                if target and norm and (target in norm or norm in target):
                    node_id = nid
                    break
        result[slot.key] = node_id
    return result

def validate_blueprint() -> List[str]:
    errors = []
    total = sum(s.count for s in BLUEPRINT_SLOTS)
    if total != 120:
        errors.append(f"Tổng số câu = {total}, phải là 120")
    for part in (1, 2, 3, 4):
        p_total = sum(s.count for s in BLUEPRINT_SLOTS if s.part == part)
        if p_total != 30:
            errors.append(f"Phần {part} có {p_total} câu, phải là 30")
    return errors
''')

    with open('d:\\MIT\\backend\\app\\services\\dgnl_blueprint.py', 'w', encoding='utf-8') as f:
        f.write('\n'.join(out))
    print("Generated dgnl_blueprint.py")

if __name__ == '__main__':
    generate_blueprint()
