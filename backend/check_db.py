import sqlite3

conn = sqlite3.connect("mit_exams.db")
c = conn.cursor()
c.execute("PRAGMA table_info(user)")
columns = c.fetchall()
has_gender = any(col[1] == "gender" for col in columns)
print("Gender column exists:", has_gender)
if not has_gender:
    print("Adding gender column...")
    c.execute("ALTER TABLE user ADD COLUMN gender VARCHAR(20) DEFAULT NULL")
    conn.commit()
    print("Gender column added.")
