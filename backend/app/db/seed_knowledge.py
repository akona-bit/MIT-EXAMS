import asyncio
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import select
from app.core.config import settings
from app.models.question import KnowledgeNode, KnowledgeNodeType

engine = create_async_engine(settings.DATABASE_URL)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession)

KNOWLEDGE_TREE = [
    {
        "name": "Tiếng Việt",
        "node_type": KnowledgeNodeType.TOPIC,
        "subject": "Tiếng Việt",
        "short_code": "TV",
        "children": [
            {
                "name": "Từ vựng - Ngữ nghĩa",
                "node_type": KnowledgeNodeType.CONCEPT,
                "short_code": "TV-TVNN",
                "children": [
                    {"name": "Từ đồng nghĩa, trái nghĩa", "node_type": KnowledgeNodeType.SKILL, "short_code": "TV-TVNN-01"},
                    {"name": "Thành ngữ, tục ngữ", "node_type": KnowledgeNodeType.SKILL, "short_code": "TV-TVNN-02"},
                    {"name": "Nghĩa của từ trong ngữ cảnh", "node_type": KnowledgeNodeType.SKILL, "short_code": "TV-TVNN-03"},
                ]
            },
            {
                "name": "Ngữ pháp",
                "node_type": KnowledgeNodeType.CONCEPT,
                "short_code": "TV-NP",
                "children": [
                    {"name": "Các biện pháp tu từ", "node_type": KnowledgeNodeType.SKILL, "short_code": "TV-NP-01"},
                    {"name": "Lỗi ngữ pháp, diễn đạt", "node_type": KnowledgeNodeType.SKILL, "short_code": "TV-NP-02"},
                ]
            },
            {
                "name": "Đọc hiểu văn bản",
                "node_type": KnowledgeNodeType.CONCEPT,
                "short_code": "TV-DH",
                "children": [
                    {"name": "Xác định nội dung chính", "node_type": KnowledgeNodeType.SKILL, "short_code": "TV-DH-01"},
                    {"name": "Phong cách ngôn ngữ", "node_type": KnowledgeNodeType.SKILL, "short_code": "TV-DH-02"},
                ]
            }
        ]
    },
    {
        "name": "Tiếng Anh",
        "node_type": KnowledgeNodeType.TOPIC,
        "subject": "Tiếng Anh",
        "short_code": "EN",
        "children": [
            {
                "name": "Vocabulary",
                "node_type": KnowledgeNodeType.CONCEPT,
                "short_code": "EN-VOC",
                "children": [
                    {"name": "Synonyms & Antonyms", "node_type": KnowledgeNodeType.SKILL, "short_code": "EN-VOC-01"},
                    {"name": "Word Choice", "node_type": KnowledgeNodeType.SKILL, "short_code": "EN-VOC-02"},
                    {"name": "Idioms & Phrasal Verbs", "node_type": KnowledgeNodeType.SKILL, "short_code": "EN-VOC-03"},
                ]
            },
            {
                "name": "Grammar",
                "node_type": KnowledgeNodeType.CONCEPT,
                "short_code": "EN-GRA",
                "children": [
                    {"name": "Tenses", "node_type": KnowledgeNodeType.SKILL, "short_code": "EN-GRA-01"},
                    {"name": "Relative Clauses", "node_type": KnowledgeNodeType.SKILL, "short_code": "EN-GRA-02"},
                    {"name": "Passive Voice", "node_type": KnowledgeNodeType.SKILL, "short_code": "EN-GRA-03"},
                ]
            },
            {
                "name": "Reading Comprehension",
                "node_type": KnowledgeNodeType.CONCEPT,
                "short_code": "EN-READ",
                "children": [
                    {"name": "Main Idea", "node_type": KnowledgeNodeType.SKILL, "short_code": "EN-READ-01"},
                    {"name": "Inference", "node_type": KnowledgeNodeType.SKILL, "short_code": "EN-READ-02"},
                ]
            }
        ]
    },
    {
        "name": "Toán học",
        "node_type": KnowledgeNodeType.TOPIC,
        "subject": "Toán học",
        "short_code": "TOAN",
        "children": [
            {
                "name": "Đại số và Giải tích",
                "node_type": KnowledgeNodeType.CONCEPT,
                "short_code": "TOAN-DS",
                "children": [
                    {"name": "Hàm số và đồ thị", "node_type": KnowledgeNodeType.SKILL, "short_code": "TOAN-DS-01"},
                    {"name": "Mũ và Logarit", "node_type": KnowledgeNodeType.SKILL, "short_code": "TOAN-DS-02"},
                    {"name": "Tích phân và Nguyên hàm", "node_type": KnowledgeNodeType.SKILL, "short_code": "TOAN-DS-03"},
                    {"name": "Tổ hợp và Xác suất", "node_type": KnowledgeNodeType.SKILL, "short_code": "TOAN-DS-04"},
                ]
            },
            {
                "name": "Hình học",
                "node_type": KnowledgeNodeType.CONCEPT,
                "short_code": "TOAN-HH",
                "children": [
                    {"name": "Hình học không gian", "node_type": KnowledgeNodeType.SKILL, "short_code": "TOAN-HH-01"},
                    {"name": "Hình học tọa độ (Oxyz)", "node_type": KnowledgeNodeType.SKILL, "short_code": "TOAN-HH-02"},
                ]
            }
        ]
    },
    {
        "name": "Tư duy logic",
        "node_type": KnowledgeNodeType.TOPIC,
        "subject": "Tư duy logic",
        "short_code": "LOGIC",
        "children": [
            {
                "name": "Logic mệnh đề",
                "node_type": KnowledgeNodeType.CONCEPT,
                "short_code": "LOGIC-MD",
                "children": [
                    {"name": "Suy luận logic", "node_type": KnowledgeNodeType.SKILL, "short_code": "LOGIC-MD-01"},
                    {"name": "Phân tích điều kiện", "node_type": KnowledgeNodeType.SKILL, "short_code": "LOGIC-MD-02"},
                ]
            },
            {
                "name": "Sắp xếp và Tổ hợp",
                "node_type": KnowledgeNodeType.CONCEPT,
                "short_code": "LOGIC-SX",
                "children": [
                    {"name": "Bài toán sắp xếp vị trí", "node_type": KnowledgeNodeType.SKILL, "short_code": "LOGIC-SX-01"},
                ]
            }
        ]
    },
    {
        "name": "Phân tích số liệu",
        "node_type": KnowledgeNodeType.TOPIC,
        "subject": "Phân tích số liệu",
        "short_code": "DATA",
        "children": [
            {
                "name": "Biểu đồ",
                "node_type": KnowledgeNodeType.CONCEPT,
                "short_code": "DATA-BD",
                "children": [
                    {"name": "Đọc hiểu biểu đồ tròn, cột, đường", "node_type": KnowledgeNodeType.SKILL, "short_code": "DATA-BD-01"},
                    {"name": "Tính toán tăng trưởng, tỷ trọng", "node_type": KnowledgeNodeType.SKILL, "short_code": "DATA-BD-02"},
                ]
            },
            {
                "name": "Bảng số liệu",
                "node_type": KnowledgeNodeType.CONCEPT,
                "short_code": "DATA-BS",
                "children": [
                    {"name": "Phân tích xu hướng từ bảng", "node_type": KnowledgeNodeType.SKILL, "short_code": "DATA-BS-01"},
                ]
            }
        ]
    },
    {
        "name": "Vật lí",
        "node_type": KnowledgeNodeType.TOPIC,
        "subject": "Vật lí",
        "short_code": "VATLI",
        "children": [
            {
                "name": "Dao động và Sóng",
                "node_type": KnowledgeNodeType.CONCEPT,
                "short_code": "VATLI-DD",
                "children": [
                    {"name": "Dao động cơ", "node_type": KnowledgeNodeType.SKILL, "short_code": "VATLI-DD-01"},
                    {"name": "Sóng cơ học", "node_type": KnowledgeNodeType.SKILL, "short_code": "VATLI-DD-02"},
                ]
            },
            {
                "name": "Điện xoay chiều",
                "node_type": KnowledgeNodeType.CONCEPT,
                "short_code": "VATLI-DIEN",
                "children": [
                    {"name": "Mạch RLC", "node_type": KnowledgeNodeType.SKILL, "short_code": "VATLI-DIEN-01"},
                ]
            }
        ]
    },
    {
        "name": "Hóa học",
        "node_type": KnowledgeNodeType.TOPIC,
        "subject": "Hóa học",
        "short_code": "HOA",
        "children": [
            {
                "name": "Hóa hữu cơ",
                "node_type": KnowledgeNodeType.CONCEPT,
                "short_code": "HOA-HC",
                "children": [
                    {"name": "Este - Lipit", "node_type": KnowledgeNodeType.SKILL, "short_code": "HOA-HC-01"},
                    {"name": "Amin - Amino axit - Protein", "node_type": KnowledgeNodeType.SKILL, "short_code": "HOA-HC-02"},
                ]
            },
            {
                "name": "Hóa vô cơ",
                "node_type": KnowledgeNodeType.CONCEPT,
                "short_code": "HOA-VC",
                "children": [
                    {"name": "Kim loại kiềm, kiềm thổ", "node_type": KnowledgeNodeType.SKILL, "short_code": "HOA-VC-01"},
                    {"name": "Sắt và hợp chất", "node_type": KnowledgeNodeType.SKILL, "short_code": "HOA-VC-02"},
                ]
            }
        ]
    },
    {
        "name": "Sinh học",
        "node_type": KnowledgeNodeType.TOPIC,
        "subject": "Sinh học",
        "short_code": "SINH",
        "children": [
            {
                "name": "Di truyền học",
                "node_type": KnowledgeNodeType.CONCEPT,
                "short_code": "SINH-DT",
                "children": [
                    {"name": "Cơ chế di truyền và biến dị", "node_type": KnowledgeNodeType.SKILL, "short_code": "SINH-DT-01"},
                    {"name": "Quy luật di truyền", "node_type": KnowledgeNodeType.SKILL, "short_code": "SINH-DT-02"},
                ]
            },
            {
                "name": "Sinh thái học",
                "node_type": KnowledgeNodeType.CONCEPT,
                "short_code": "SINH-ST",
                "children": [
                    {"name": "Quần thể sinh vật", "node_type": KnowledgeNodeType.SKILL, "short_code": "SINH-ST-01"},
                ]
            }
        ]
    },
    {
        "name": "Lịch sử",
        "node_type": KnowledgeNodeType.TOPIC,
        "subject": "Lịch sử",
        "short_code": "SU",
        "children": [
            {
                "name": "Lịch sử Việt Nam (1919-2000)",
                "node_type": KnowledgeNodeType.CONCEPT,
                "short_code": "SU-VN",
                "children": [
                    {"name": "Phong trào giải phóng dân tộc (1939-1945)", "node_type": KnowledgeNodeType.SKILL, "short_code": "SU-VN-01"},
                    {"name": "Kháng chiến chống Pháp (1945-1954)", "node_type": KnowledgeNodeType.SKILL, "short_code": "SU-VN-02"},
                    {"name": "Kháng chiến chống Mỹ (1954-1975)", "node_type": KnowledgeNodeType.SKILL, "short_code": "SU-VN-03"},
                ]
            },
            {
                "name": "Lịch sử Thế giới hiện đại",
                "node_type": KnowledgeNodeType.CONCEPT,
                "short_code": "SU-TG",
                "children": [
                    {"name": "Quan hệ quốc tế sau 1945", "node_type": KnowledgeNodeType.SKILL, "short_code": "SU-TG-01"},
                ]
            }
        ]
    },
    {
        "name": "Địa lí",
        "node_type": KnowledgeNodeType.TOPIC,
        "subject": "Địa lí",
        "short_code": "DIA",
        "children": [
            {
                "name": "Địa lí tự nhiên Việt Nam",
                "node_type": KnowledgeNodeType.CONCEPT,
                "short_code": "DIA-TN",
                "children": [
                    {"name": "Vị trí địa lí và lãnh thổ", "node_type": KnowledgeNodeType.SKILL, "short_code": "DIA-TN-01"},
                    {"name": "Đặc điểm khí hậu", "node_type": KnowledgeNodeType.SKILL, "short_code": "DIA-TN-02"},
                ]
            },
            {
                "name": "Địa lí kinh tế - xã hội",
                "node_type": KnowledgeNodeType.CONCEPT,
                "short_code": "DIA-KT",
                "children": [
                    {"name": "Đặc điểm dân số", "node_type": KnowledgeNodeType.SKILL, "short_code": "DIA-KT-01"},
                    {"name": "Các vùng kinh tế trọng điểm", "node_type": KnowledgeNodeType.SKILL, "short_code": "DIA-KT-02"},
                ]
            }
        ]
    }
]

async def insert_node(session, data, parent_id=None, subject=None):
    # Determine subject mapping
    node_subject = data.get("subject", subject)
    
    # Extract children
    children_data = data.get("children", [])
    
    node = KnowledgeNode(
        name=data["name"],
        node_type=data["node_type"],
        short_code=data.get("short_code"),
        subject=node_subject,
        parent_id=parent_id,
        is_leaf=len(children_data) == 0
    )
    session.add(node)
    await session.flush() # flush to get the ID
    
    # Update path_code
    if parent_id:
        parent = await session.get(KnowledgeNode, parent_id)
        node.path_code = f"{parent.path_code}.{node.id}"
    else:
        node.path_code = str(node.id)
        
    await session.flush()
    
    for child in children_data:
        await insert_node(session, child, parent_id=node.id, subject=node_subject)

async def seed_knowledge():
    async with AsyncSessionLocal() as session:
        # Check if already seeded
        result = await session.execute(select(KnowledgeNode).limit(1))
        if result.scalars().first():
            print("Knowledge nodes already seeded.")
            return

        print("Seeding knowledge nodes...")
        for topic in KNOWLEDGE_TREE:
            await insert_node(session, topic)
            
        await session.commit()
        print("Successfully seeded Knowledge Nodes.")

async def main():
    await seed_knowledge()

if __name__ == "__main__":
    asyncio.run(main())
