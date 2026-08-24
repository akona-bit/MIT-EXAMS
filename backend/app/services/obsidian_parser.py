import yaml
import re
from typing import Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.question import Question, Answer, KnowledgeNode, QuestionType, QuestionStatus

class ObsidianParser:
    def __init__(self, db: AsyncSession, creator_id: int):
        self.db = db
        self.creator_id = creator_id

    async def get_or_create_knowledge_node(self, path: str) -> KnowledgeNode:
        """
        path: "Toan_Hoc/Dai_So/Phuong_Trinh"
        """
        parts = path.split('/')
        parent_id = None
        current_node = None
        for part in parts:
            part = part.strip()
            if not part:
                continue
            
            stmt = select(KnowledgeNode).where(
                KnowledgeNode.name == part,
                KnowledgeNode.parent_id == parent_id
            )
            result = await self.db.execute(stmt)
            node = result.scalars().first()
            
            if not node:
                node = KnowledgeNode(name=part, parent_id=parent_id)
                self.db.add(node)
                await self.db.flush()
            
            current_node = node
            parent_id = node.id
            
        return current_node

    async def parse_and_import(self, filename: str, content: str) -> Dict[str, Any]:
        # Split frontmatter
        parts = content.split('---')
        if len(parts) < 3:
            return {"status": "skipped", "reason": "No valid YAML frontmatter"}
            
        frontmatter_str = parts[1]
        body = '---'.join(parts[2:]).strip()
        
        try:
            metadata = yaml.safe_load(frontmatter_str)
        except Exception as e:
            return {"status": "error", "reason": f"YAML parse error: {str(e)}"}
            
        if metadata.get('type') != 'question':
            return {"status": "skipped", "reason": "Not a question file"}
            
        # Extract knowledge node
        kn_path = metadata.get('knowledge_node')
        if not kn_path:
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
        q_type_str = metadata.get('question_type', 'SINGLE_CHOICE')
        try:
            q_type = QuestionType(q_type_str)
        except ValueError:
            q_type = QuestionType.SINGLE_CHOICE
            
        question = Question(
            content='\n'.join(question_lines).strip(),
            level=q_level,
            type=q_type,
            status=QuestionStatus.APPROVED, # Default to approved for synced files?
            knowledge_node_id=kn_node.id,
            creator_id=self.creator_id
        )
        self.db.add(question)
        await self.db.flush()
        
        # Create Answers
        for idx, ans_dict in enumerate(answers):
            ans = Answer(
                question_id=question.id,
                content=ans_dict["content"],
                is_correct=ans_dict["is_correct"],
                position=idx
            )
            self.db.add(ans)
            
        return {"status": "success", "question_id": question.id}
