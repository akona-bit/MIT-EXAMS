import asyncio
import sys
import os

sys.path.insert(0, os.path.abspath('backend'))
from backend.app.db.session import async_session
from backend.app.api.v1.matrix import dgnl_blueprint_template

async def test():
    db = async_session()
    res = await dgnl_blueprint_template(db)
    print("Groups:", len(res["groups"]))
    print("Rules:", len(res["rules"]))
    await db.close()

if __name__ == "__main__":
    asyncio.run(test())
