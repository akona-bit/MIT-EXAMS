#!/usr/bin/env python
"""Add admin user to first exam as participant"""
import asyncio
import sys
from sqlalchemy import select
from app.db.database import AsyncSessionLocal
from app.models.user import User
from app.models.exam import Exam, ExamParticipant

async def main():
    async with AsyncSessionLocal() as session:
        try:
            # Get admin user
            result = await session.execute(select(User).where(User.email == 'admin@example.com'))
            user = result.scalars().first()
            if not user:
                print('❌ Admin user not found')
                return
            print(f'✅ Found user: {user.email} (ID: {user.id})')
            
            # Get first exam
            result = await session.execute(select(Exam).limit(1))
            exam = result.scalars().first()
            if not exam:
                print('❌ No exam found')
                return
            print(f'✅ Found exam: {exam.name} (ID: {exam.id})')
            
            # Check if participant already exists
            result = await session.execute(
                select(ExamParticipant).where(
                    (ExamParticipant.exam_id == exam.id) &
                    (ExamParticipant.user_id == user.id)
                )
            )
            existing = result.scalars().first()
            if existing:
                print(f'⚠️  Participant already exists')
                return
            
            # Add participant
            participant = ExamParticipant(
                exam_id=exam.id,
                user_id=user.id,
                participant_status='NOT_STARTED'
            )
            session.add(participant)
            await session.commit()
            print(f'✅ Added {user.email} to exam "{exam.name}"')
            
        except Exception as e:
            print(f'❌ Error: {e}')
            sys.exit(1)

if __name__ == '__main__':
    asyncio.run(main())
