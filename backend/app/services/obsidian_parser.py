import yaml
import re
from typing import Any, Dict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.question import Question, Answer, KnowledgeNode, QuestionType, QuestionStatus
from app.services.knowledge_service import KnowledgeService

class ObsidianParser:
    def __init__(self, db: AsyncSession, creator_id: int):
        self.db = db
        self.creator_id = creator_id

    async def get_or_create_knowledge_node(self, path: str) -> KnowledgeNode:
        """
        path: "Toan_Hoc/Dai_So/Phuong_Trinh"
        """
        parts = path.split('/')
        parent_node = None
        current_node = None
        for part in parts:
            part = part.strip()
            if not part:
                continue

            # Find existing node matching name and primary parent
            stmt = select(KnowledgeNode).where(KnowledgeNode.name == part)
            result = await self.db.execute(stmt)
            candidates = result.scalars().all()

            node = None
            if parent_node:
                # Among candidates, find one that has parent_node as primary parent
                from app.models.question import KnowledgeNodeParent
                for c in candidates:
                    check = await self.db.execute(
                        select(KnowledgeNodeParent).where(
                            KnowledgeNodeParent.child_id == c.id,
                            KnowledgeNodeParent.parent_id == parent_node.id,
                            KnowledgeNodeParent.is_primary == True
                        )
                    )
                    if check.scalar_one_or_none():
                        node = c
                        break
            else:
                # Root level: find node with no primary parent
                from app.models.question import KnowledgeNodeParent
                for c in candidates:
                    check = await self.db.execute(
                        select(KnowledgeNodeParent).where(
                            KnowledgeNodeParent.child_id == c.id,
                            KnowledgeNodeParent.is_primary == True
                        )
                    )
                    if not check.scalar_one_or_none():
                        node = c
                        break

            if not node:
                node = KnowledgeNode(name=part)
                self.db.add(node)
                await self.db.flush()

            if parent_node and node:
                await KnowledgeService.add_relation(self.db, node.id, parent_node.id, is_primary=True)

            current_node = node
            parent_node = node

        return current_node

    async def parse_and_import(
        self,
        filename: str,
        content: str,
        parent_question_id: int | None = None,
    ) -> Dict[str, Any]:
        frontmatter_match = re.match(r"^\ufeff?---\s*\n(?P<frontmatter>.*?)\n---\s*(?:\n|$)(?P<body>[\s\S]*)$", content)
        if not frontmatter_match:
            return {"status": "skipped", "reason": "No valid YAML frontmatter"}

        frontmatter_str = frontmatter_match.group("frontmatter")
        body = frontmatter_match.group("body").strip()
        
        try:
            metadata = yaml.safe_load(frontmatter_str)
        except Exception as e:
            return {"status": "error", "reason": f"YAML parse error: {str(e)}"}

        if not isinstance(metadata, dict):
            return {"status": "error", "reason": "Frontmatter must be a YAML object"}
            
        if metadata.get('type') != 'question':
            return {"status": "skipped", "reason": "Not a question file"}
            
        # Extract knowledge node
        kn_path = metadata.get('knowledge_node')
        if not isinstance(kn_path, str) or not kn_path.strip():
            return {"status": "error", "reason": "Missing knowledge_node in frontmatter"}
            
        kn_node = await self.get_or_create_knowledge_node(kn_path)
        
        # Parse body for question content and answers
        # A simple parser that looks for lines starting with "- [ ]" or "- [x]"
        lines = body.split('\n')
        question_lines = []
        answers = []
        
        for line in lines:
            stripped = line.strip()
            is_correct_match = re.match(r'^-\s*\[([xX\s])\]\s+(.*)$', stripped)
            if is_correct_match:
                is_correct = is_correct_match.group(1).lower() == 'x'
                answer_content = is_correct_match.group(2).strip()
                answers.append({
                    "content": answer_content,
                    "is_correct": is_correct
                })
            else:
                if not answers: # still reading question body
                    question_lines.append(line)
                else:
                    # Ignore lines after answers, or append them somewhere? Let's just ignore for now
                    pass
                    
        if not answers:
            return {"status": "error", "reason": "No answers found in markdown (must use - [ ] or - [x])"}
            
        # Create Question
        q_level = metadata.get('level', 1)
        if isinstance(q_level, bool) or not isinstance(q_level, int) or not 1 <= q_level <= 4:
            return {"status": "error", "reason": "level must be an integer from 1 to 4"}

        q_type_str = metadata.get('question_type', 'SINGLE_CHOICE')
        try:
            q_type = QuestionType(q_type_str)
        except ValueError:
            return {"status": "error", "reason": f"Unsupported question_type: {q_type_str}"}

        if not question_lines or not '\n'.join(question_lines).strip():
            return {"status": "error", "reason": "Question content is empty"}

        if len(answers) < 2:
            return {"status": "error", "reason": "At least two answers are required"}

        correct_count = sum(1 for answer in answers if answer["is_correct"])
        if q_type == QuestionType.SINGLE_CHOICE and correct_count != 1:
            return {"status": "error", "reason": "SINGLE_CHOICE requires exactly one correct answer"}
        if q_type == QuestionType.MULTIPLE_CHOICE and correct_count < 1:
            return {"status": "error", "reason": "MULTIPLE_CHOICE requires at least one correct answer"}
            
        question = Question(
            content='\n'.join(question_lines).strip(),
            level=q_level,
            type=q_type,
            status=QuestionStatus.PENDING,
            knowledge_node_id=kn_node.id,
            creator_id=self.creator_id,
            parent_question_id=parent_question_id,
        )
        self.db.add(question)
        await self.db.flush()
        
        # Create Answers
        for idx, ans_dict in enumerate(answers, start=1):
            ans = Answer(
                question_id=question.id,
                content=ans_dict["content"],
                is_correct=ans_dict["is_correct"],
                position=idx
            )
            self.db.add(ans)
            
        wikilinks = sorted(set(re.findall(r"\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]", body)))
        return {
            "status": "success",
            "question_id": question.id,
            "source_file": filename,
            "wikilinks": wikilinks,
        }
