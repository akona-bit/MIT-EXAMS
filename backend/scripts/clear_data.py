import asyncio
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from scripts.full_reset_and_simulate import clear_all, seed_roles_and_admin

async def main():
    print("Bat dau xoa tat ca du lieu test...")
    await clear_all()
    await seed_roles_and_admin()
    print("Hoan tat xoa du lieu.")

if __name__ == "__main__":
    asyncio.run(main())
