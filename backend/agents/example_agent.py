"""
Example: a calculator agent that uses a tool to evaluate math expressions.

Run:
    ANTHROPIC_API_KEY=sk-... uv run python -m agents.example_agent
"""

import ast
import operator

from agents.base_agent import BaseAgent

_OPS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.Pow: operator.pow,
    ast.USub: operator.neg,
}

CALCULATOR_TOOL = {
    "name": "calculate",
    "description": "Evaluate a safe arithmetic expression and return the numeric result.",
    "input_schema": {
        "type": "object",
        "properties": {
            "expression": {"type": "string", "description": "Arithmetic expression, e.g. '2 ** 10'"}
        },
        "required": ["expression"],
    },
}


def _eval(node: ast.AST) -> float:
    if isinstance(node, ast.Constant):
        return float(node.value)
    if isinstance(node, ast.BinOp):
        return _OPS[type(node.op)](_eval(node.left), _eval(node.right))
    if isinstance(node, ast.UnaryOp):
        return _OPS[type(node.op)](_eval(node.operand))
    raise ValueError(f"Unsupported expression node: {type(node)}")


def handle_calculate(_name: str, inputs: dict) -> dict:
    try:
        tree = ast.parse(inputs["expression"], mode="eval")
        result = _eval(tree.body)
        return {"result": result}
    except Exception as exc:
        return {"error": str(exc)}


def build_calculator_agent() -> BaseAgent:
    return BaseAgent(
        system="You are a math assistant. Use the calculate tool for all arithmetic.",
        tools=[CALCULATOR_TOOL],
        tool_handlers={"calculate": handle_calculate},
    )


if __name__ == "__main__":
    agent = build_calculator_agent()
    answer = agent.run("What is (2 ** 10) + (3 * 7) - 15?")
    print(answer)
