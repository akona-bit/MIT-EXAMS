import re

with open('backend/app/api/v1/questions.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Pattern to find any options clause that starts with selectinload(Question.answers)
# We need to replace it carefully to not match the ones we already modified.
pattern1 = re.compile(r'select\(Question\)\.options\(selectinload\(Question\.answers\), selectinload\(Question\.skill_tags\)\)')
replacement = 'select(Question).options(selectinload(Question.answers), selectinload(Question.sub_items), selectinload(Question.skill_tags))'

content = pattern1.sub(replacement, content)

pattern2 = re.compile(r'select\(Question\)\.options\(selectinload\(Question\.answers\)\)')
content = pattern2.sub(replacement, content)

with open('backend/app/api/v1/questions.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("Replacement done.")
