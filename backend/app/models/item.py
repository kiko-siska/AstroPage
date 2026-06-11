from dataclasses import dataclass, field


@dataclass
class Item:
    id: int
    name: str
    description: str = field(default="")
