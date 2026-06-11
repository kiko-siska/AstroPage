"""
Base agentic loop: tool-use → observation → next step, until stop_reason == "end_turn".
Requires ANTHROPIC_API_KEY in environment.
"""

import json
import logging
from collections.abc import Callable
from typing import Any

import anthropic

logger = logging.getLogger(__name__)

ToolHandler = Callable[[str, dict], Any]


class BaseAgent:
    """Minimal agent that runs an agentic loop with tool use."""

    def __init__(
        self,
        model: str = "claude-sonnet-4-6",
        system: str = "You are a helpful assistant.",
        tools: list[dict] | None = None,
        tool_handlers: dict[str, ToolHandler] | None = None,
        max_iterations: int = 10,
    ) -> None:
        self.client = anthropic.Anthropic()
        self.model = model
        self.system = system
        self.tools = tools or []
        self.tool_handlers = tool_handlers or {}
        self.max_iterations = max_iterations

    def run(self, user_message: str) -> str:
        messages: list[dict] = [{"role": "user", "content": user_message}]

        for iteration in range(self.max_iterations):
            response = self.client.messages.create(
                model=self.model,
                max_tokens=4096,
                system=self.system,
                tools=self.tools,
                messages=messages,
            )
            logger.debug("Iteration %d stop_reason=%s", iteration, response.stop_reason)

            # Append assistant turn
            messages.append({"role": "assistant", "content": response.content})

            if response.stop_reason == "end_turn":
                # Extract final text block
                for block in response.content:
                    if hasattr(block, "text"):
                        return block.text
                return ""

            if response.stop_reason == "tool_use":
                tool_results = []
                for block in response.content:
                    if block.type != "tool_use":
                        continue
                    handler = self.tool_handlers.get(block.name)
                    if handler is None:
                        result = {"error": f"Unknown tool: {block.name}"}
                    else:
                        try:
                            result = handler(block.name, block.input)
                        except Exception as exc:
                            result = {"error": str(exc)}
                    tool_results.append(
                        {
                            "type": "tool_result",
                            "tool_use_id": block.id,
                            "content": json.dumps(result),
                        }
                    )
                messages.append({"role": "user", "content": tool_results})
                continue

            # Unexpected stop reason
            break

        return "[agent reached max iterations without end_turn]"
