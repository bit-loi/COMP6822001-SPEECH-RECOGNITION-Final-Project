from dataclasses import dataclass


@dataclass(frozen=True)
class DemoUser:
    id: str = "demo_user"


async def verify_user() -> DemoUser:
    return DemoUser()
