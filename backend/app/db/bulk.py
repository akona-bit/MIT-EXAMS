from sqlalchemy import insert, update
from typing import Type, List, Dict, Any

async def bulk_insert(session, model: Type, mappings: List[Dict[str, Any]], batch_size: int = 100):
    """
    Insert multiple records in batches.
    
    Args:
        session: AsyncSession
        model: SQLAlchemy Model class
        mappings: List of dictionaries containing row data
        batch_size: Number of records to insert per batch
    """
    if not mappings:
        return
        
    for i in range(0, len(mappings), batch_size):
        batch = mappings[i:i + batch_size]
        await session.execute(insert(model), batch)
    
    await session.flush()

async def bulk_update(session, model: Type, mappings: List[Dict[str, Any]], batch_size: int = 100):
    """
    Update multiple records in batches.
    Requires each dictionary in `mappings` to contain the primary key(s) of the model.
    
    Args:
        session: AsyncSession
        model: SQLAlchemy Model class
        mappings: List of dictionaries containing primary key(s) and update data
        batch_size: Number of records to update per batch
    """
    if not mappings:
        return
        
    for i in range(0, len(mappings), batch_size):
        batch = mappings[i:i + batch_size]
        await session.execute(update(model), batch)
    
    await session.flush()
