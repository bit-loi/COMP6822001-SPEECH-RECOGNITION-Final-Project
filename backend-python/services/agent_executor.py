"""
AmbatuCode Agent Executor
─────────────────────────
Uses Gemini Function Calling (real tool use) so the AI can:
  - create / read / write files in the editor
  - run terminal commands
  - auto-commit and push to GitHub
  - search for code patterns

The chat response now optionally contains structured `actions` that the
frontend executes — turning the AI from a chat-bot into a real automation agent.
"""

import asyncio
import os
import json
import google.generativeai as genai
from typing import Optional
from tools.git_automation import auto_commit_and_push, git_status, git_diff
from tools.code import analyze_code_snippet, explain_error_plain_language

# ──────────────────────────────────────────────────────────────────────────────
# Tool definitions (Gemini Function Calling schema)
# ──────────────────────────────────────────────────────────────────────────────

TOOLS = [
    genai.protos.Tool(function_declarations=[

        # 1. Create a new file with generated code
        genai.protos.FunctionDeclaration(
            name="create_file",
            description=(
                "Create a new file in the user's project with the given content. "
                "Use this when the user asks to create, write, or generate a new file."
            ),
            parameters=genai.protos.Schema(
                type=genai.protos.Type.OBJECT,
                properties={
                    "filename": genai.protos.Schema(
                        type=genai.protos.Type.STRING,
                        description="File name with extension, e.g. 'utils.py' or 'components/Button.tsx'"
                    ),
                    "content": genai.protos.Schema(
                        type=genai.protos.Type.STRING,
                        description="Full file content to write"
                    ),
                    "explanation": genai.protos.Schema(
                        type=genai.protos.Type.STRING,
                        description="Brief explanation of what the file does"
                    ),
                },
                required=["filename", "content", "explanation"]
            )
        ),

        # 2. Insert/append code into the active editor file
        genai.protos.FunctionDeclaration(
            name="insert_code",
            description=(
                "Insert or append code into the currently open file in the editor. "
                "Use when user asks to add a function, class, or code block to an existing file."
            ),
            parameters=genai.protos.Schema(
                type=genai.protos.Type.OBJECT,
                properties={
                    "code": genai.protos.Schema(
                        type=genai.protos.Type.STRING,
                        description="Code to insert"
                    ),
                    "position": genai.protos.Schema(
                        type=genai.protos.Type.STRING,
                        description="Where to insert: 'end' (default), 'beginning', or 'cursor'"
                    ),
                    "explanation": genai.protos.Schema(
                        type=genai.protos.Type.STRING,
                        description="Brief explanation of the inserted code"
                    ),
                },
                required=["code", "explanation"]
            )
        ),

        # 3. Replace entire file content
        genai.protos.FunctionDeclaration(
            name="update_file",
            description=(
                "Replace the full content of the currently open file. "
                "Use when user asks to refactor, rewrite, or significantly modify an existing file."
            ),
            parameters=genai.protos.Schema(
                type=genai.protos.Type.OBJECT,
                properties={
                    "content": genai.protos.Schema(
                        type=genai.protos.Type.STRING,
                        description="New full file content"
                    ),
                    "explanation": genai.protos.Schema(
                        type=genai.protos.Type.STRING,
                        description="Summary of changes made"
                    ),
                },
                required=["content", "explanation"]
            )
        ),
        # 4. Delete a file
        genai.protos.FunctionDeclaration(
            name="delete_file",
            description=(
                "Delete an existing file from the project. "
                "Use ONLY when the user explicitly asks to delete, remove, or trash a specific file."
            ),
            parameters=genai.protos.Schema(
                type=genai.protos.Type.OBJECT,
                properties={
                    "filename": genai.protos.Schema(
                        type=genai.protos.Type.STRING,
                        description="File name or path to delete"
                    ),
                    "explanation": genai.protos.Schema(
                        type=genai.protos.Type.STRING,
                        description="Why the file is being deleted"
                    ),
                },
                required=["filename", "explanation"]
            )
        ),

        # 5. Create a folder
        genai.protos.FunctionDeclaration(
            name="create_folder",
            description="Create a new folder/directory in the user's project.",
            parameters=genai.protos.Schema(
                type=genai.protos.Type.OBJECT,
                properties={
                    "folder_name": genai.protos.Schema(
                        type=genai.protos.Type.STRING,
                        description="Folder name or path (e.g., 'src/components')"
                    ),
                    "explanation": genai.protos.Schema(
                        type=genai.protos.Type.STRING,
                        description="Explanation of why this folder is created"
                    ),
                },
                required=["folder_name", "explanation"]
            )
        ),

        # 6. Delete a folder
        genai.protos.FunctionDeclaration(
            name="delete_folder",
            description="Delete an existing folder from the project.",
            parameters=genai.protos.Schema(
                type=genai.protos.Type.OBJECT,
                properties={
                    "folder_name": genai.protos.Schema(
                        type=genai.protos.Type.STRING,
                        description="Folder name or path to delete"
                    ),
                    "explanation": genai.protos.Schema(
                        type=genai.protos.Type.STRING,
                        description="Explanation of why this folder is deleted"
                    ),
                },
                required=["folder_name", "explanation"]
            )
        ),

        # 7. Toggle Focus Mode
        genai.protos.FunctionDeclaration(
            name="toggle_focus_mode",
            description="Enable or disable Focus Mode (hides sidebar/terminal/chat to reduce distraction).",
            parameters=genai.protos.Schema(
                type=genai.protos.Type.OBJECT,
                properties={
                    "state": genai.protos.Schema(
                        type=genai.protos.Type.STRING,
                        description="State to set: 'on', 'off', or 'toggle'"
                    ),
                    "explanation": genai.protos.Schema(
                        type=genai.protos.Type.STRING,
                        description="Why focus mode is being changed"
                    ),
                },
                required=["state", "explanation"]
            )
        ),

        # 8. Close/Open Chat Panel
        genai.protos.FunctionDeclaration(
            name="toggle_chat_panel",
            description="Close or open the AI chat panel.",
            parameters=genai.protos.Schema(
                type=genai.protos.Type.OBJECT,
                properties={
                    "state": genai.protos.Schema(
                        type=genai.protos.Type.STRING,
                        description="State to set: 'open', 'close', or 'toggle'"
                    ),
                    "explanation": genai.protos.Schema(
                        type=genai.protos.Type.STRING,
                        description="Why chat panel is being toggled"
                    ),
                },
                required=["state", "explanation"]
            )
        ),

        # 9. Toggle Theme / Dark Mode
        genai.protos.FunctionDeclaration(
            name="toggle_theme",
            description="Change the editor's visual theme (light vs dark mode).",
            parameters=genai.protos.Schema(
                type=genai.protos.Type.OBJECT,
                properties={
                    "theme": genai.protos.Schema(
                        type=genai.protos.Type.STRING,
                        description="Theme to set: 'dark', 'light', or 'toggle'"
                    ),
                    "explanation": genai.protos.Schema(
                        type=genai.protos.Type.STRING,
                        description="Why the theme is being changed"
                    ),
                },
                required=["theme", "explanation"]
            )
        ),

        # 4. Run a terminal command
        genai.protos.FunctionDeclaration(
            name="run_command",
            description=(
                "Execute a shell command in the terminal. "
                "Use for: running scripts, installing packages, running tests, starting servers. "
                "NEVER use for destructive commands like rm -rf or format."
            ),
            parameters=genai.protos.Schema(
                type=genai.protos.Type.OBJECT,
                properties={
                    "command": genai.protos.Schema(
                        type=genai.protos.Type.STRING,
                        description="Shell command to run, e.g. 'pip install requests' or 'python main.py'"
                    ),
                    "explanation": genai.protos.Schema(
                        type=genai.protos.Type.STRING,
                        description="What this command does"
                    ),
                },
                required=["command", "explanation"]
            )
        ),

        # 5. Git auto-commit and push
        genai.protos.FunctionDeclaration(
            name="git_commit_push",
            description=(
                "Stage all changes, auto-generate a commit message, and push to GitHub. "
                "Use when user says 'commit', 'push', 'save to GitHub', or 'deploy'."
            ),
            parameters=genai.protos.Schema(
                type=genai.protos.Type.OBJECT,
                properties={
                    "branch": genai.protos.Schema(
                        type=genai.protos.Type.STRING,
                        description="Branch to push to (default: main)"
                    ),
                    "custom_message": genai.protos.Schema(
                        type=genai.protos.Type.STRING,
                        description="Custom commit message (optional, AI will generate one if empty)"
                    ),
                },
                required=[]
            )
        ),

        # 6. Search code in project
        genai.protos.FunctionDeclaration(
            name="search_code",
            description=(
                "Search for a pattern or function name across the project files provided in context. "
                "Use when user asks 'where is X defined' or 'find all uses of Y'."
            ),
            parameters=genai.protos.Schema(
                type=genai.protos.Type.OBJECT,
                properties={
                    "query": genai.protos.Schema(
                        type=genai.protos.Type.STRING,
                        description="Search query or pattern to find"
                    ),
                },
                required=["query"]
            )
        ),

        # 7. Update Cognitive Settings (ADHD, Dyslexia, Visual)
        genai.protos.FunctionDeclaration(
            name="update_cognitive_settings",
            description=(
                "Update specialized cognitive settings like Dyslexia Mode, Task Chunking, "
                "Time Estimates, or Reduced Visual Noise."
            ),
            parameters=genai.protos.Schema(
                type=genai.protos.Type.OBJECT,
                properties={
                    "dyslexia_mode": genai.protos.Schema(type=genai.protos.Type.BOOLEAN, description="Enable specialized font and spacing for dyslexia"),
                    "task_chunking": genai.protos.Schema(type=genai.protos.Type.BOOLEAN, description="Break down complex tasks into visual steps"),
                    "time_estimates": genai.protos.Schema(type=genai.protos.Type.BOOLEAN, description="Show estimated completion time for code blocks"),
                    "reduced_noise": genai.protos.Schema(type=genai.protos.Type.BOOLEAN, description="Hide non-essential UI elements to reduce sensory overload"),
                    "explanation": genai.protos.Schema(type=genai.protos.Type.STRING, description="Why these settings are being changed")
                },
                required=["explanation"]
            )
        ),

        # 8. Set Language
        genai.protos.FunctionDeclaration(
            name="set_ui_language",
            description="Change the interface language (e.g., to Indonesian, Japanese, Spanish, or English).",
            parameters=genai.protos.Schema(
                type=genai.protos.Type.OBJECT,
                properties={
                    "language": genai.protos.Schema(
                        type=genai.protos.Type.STRING,
                        description="Language code: 'en', 'id', 'es', 'ja', 'fr', etc."
                    ),
                    "explanation": genai.protos.Schema(
                        type=genai.protos.Type.STRING,
                        description="Explanation in the target language"
                    )
                },
                required=["language", "explanation"]
            )
        ),

        # 9. Control Pomodoro Timer
        genai.protos.FunctionDeclaration(
            name="control_pomodoro",
            description="Start, stop, or configure the Pomodoro timer for focused work sessions.",
            parameters=genai.protos.Schema(
                type=genai.protos.Type.OBJECT,
                properties={
                    "state": genai.protos.Schema(type=genai.protos.Type.STRING, description="'start', 'stop', or 'configure'"),
                    "work_minutes": genai.protos.Schema(type=genai.protos.Type.INTEGER, description="Duration for work session (default 25)"),
                    "break_minutes": genai.protos.Schema(type=genai.protos.Type.INTEGER, description="Duration for break (default 5)"),
                    "explanation": genai.protos.Schema(type=genai.protos.Type.STRING, description="Why the timer is being used")
                },
                required=["state", "explanation"]
            )
        ),

        # 10. Set Font Size
        genai.protos.FunctionDeclaration(
            name="set_font_size",
            description="Adjust the editor's font size for better readability.",
            parameters=genai.protos.Schema(
                type=genai.protos.Type.OBJECT,
                properties={
                    "size": genai.protos.Schema(type=genai.protos.Type.INTEGER, description="Font size in pixels (e.g. 14, 16, 18)"),
                    "explanation": genai.protos.Schema(type=genai.protos.Type.STRING, description="Why the font size is being changed")
                },
                required=["size", "explanation"]
            )
        ),

        # 11. Execute the active file
        genai.protos.FunctionDeclaration(
            name="execute_active_file",
            description=(
                "Automatically detect the language of the currently open file and run it. "
                "Supported: Python (.py), JavaScript (.js), Go (.go), Rust (.rs). "
                "Use this when the user says 'run this code', 'execute', or 'show me the result'."
            ),
            parameters=genai.protos.Schema(
                type=genai.protos.Type.OBJECT,
                properties={
                    "explanation": genai.protos.Schema(
                        type=genai.protos.Type.STRING,
                        description="Why we are running the code"
                    ),
                },
                required=["explanation"]
            )
        ),

    ])
]

# ──────────────────────────────────────────────────────────────────────────────
# Tool executor (server-side actions)
# ──────────────────────────────────────────────────────────────────────────────

async def execute_tool_server_side(name: str, args: dict, repo_path: str = ".") -> dict:
    """Execute tools that run on the server (git, terminal)."""

    if name == "git_commit_push":
        branch = args.get("branch", "main")
        msg = args.get("custom_message", None)
        result = await asyncio.to_thread(auto_commit_and_push, repo_path, branch, msg)
        return result

    if name == "run_command":
        # Safety: block destructive commands
        cmd = args.get("command", "")
        blocked = ["rm -rf", "rmdir /s", "format", "del /", "mkfs", "dd if"]
        if any(b in cmd.lower() for b in blocked):
            return {"success": False, "error": "Command blocked for safety."}

        import subprocess
        result = await asyncio.to_thread(
            lambda: subprocess.run(
                cmd, shell=True, cwd=repo_path,
                capture_output=True, text=True, timeout=30
            )
        )
        return {
            "success": result.returncode == 0,
            "stdout": result.stdout[:2000],
            "stderr": result.stderr[:500],
        }

    if name == "execute_active_file":
        # Note: This tool works best when editor_context is provided
        import subprocess
        
        # We need a way to know the filename. In a real scenario, 
        # this might be passed via args or inferred from the repo_path.
        # For now, we use a generic command runner.
        return {"client_side": True} # Let frontend handle this as it knows which file is active
    
    # All other tools (create_file, insert_code, update_file, search_code, execute_active_file)
    # are CLIENT-SIDE — frontend will handle them
    return {"client_side": True}


# ──────────────────────────────────────────────────────────────────────────────
# Main Agentic Executor
# ──────────────────────────────────────────────────────────────────────────────

class AgentExecutor:
    def __init__(self):
        genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
        self.model = genai.GenerativeModel(
            model_name="gemini-2.0-flash",
            generation_config={
                "temperature": 0.2,
                "top_p": 0.95,
                "max_output_tokens": 8192,
            },
            tools=TOOLS,
        )

    async def run(
        self,
        message: str,
        context: str,
        user_profile: dict,
        editor_context: dict = None,
        repo_path: str = ".",
        ui_language: str = "en",
    ) -> dict:
        """
        Run the agentic loop with Gemini Function Calling.

        Returns:
            {
              "message": str,           # Natural language response to show user
              "actions": list[dict],    # Actions for frontend to execute
              "server_results": list,   # Results of server-side tool calls
            }
        """
        editor_ctx_str = ""
        if editor_context:
            editor_ctx_str = f"""
Current file: {editor_context.get('filename', 'untitled')}
Language: {editor_context.get('file_language', 'unknown')}
Cursor: Line {editor_context.get('cursor_line', 1)}, Col {editor_context.get('cursor_col', 1)}
Selected text: {editor_context.get('selected_text', 'none')}
File content preview:
```
{(editor_context.get('surrounding_code', '') or '')[:1500]}
```
"""

        system_prompt = f"""You are AmbatuCode, an AI coding assistant that can TAKE REAL ACTIONS in the user's code editor.

{context}

=== EDITOR STATE ===
{editor_ctx_str or 'No file currently open.'}

=== USER PROFILE ===
Cognitive needs: {', '.join(user_profile.get('cognitive_needs', [])) or 'none specified'}

=== LANGUAGE POLICY ===
CRITICAL: The user's interface language is set to: {ui_language}. 
1. ALWAYS respond in the language that matches {ui_language} (e.g., if 'en' then English, if 'id' then Indonesian, etc.).
2. Even if the user writes in a different language, your CORE response text should be in {ui_language}, though you can acknowledge the user's language choice.
3. If the user explicitly asks to switch languages (e.g. 'Speak Japanese'), then you can switch and also use the 'set_ui_language' tool.
4. Tool action `explanation` fields MUST be in {ui_language}.

=== YOUR CAPABILITIES ===
You can use tools to:
- create_file: Create a brand new file with generated code
- insert_code: Add code to the currently open file
- update_file: Rewrite/refactor the current file
- delete_file: Delete a file from the project
- create_folder: Create a new folder
- delete_folder: Delete a folder
- toggle_focus_mode: Enable/disable distraction-free focus mode
- toggle_chat_panel: Open/close the AI chat panel
- toggle_theme: Change between light mode and dark mode
- update_cognitive_settings: Toggle Dyslexia mode, Task Chunking, Time Estimates, or Reduced Noise
- set_ui_language: Change the language of the entire editor interface
- control_pomodoro: Manage work/break timer sessions
- set_font_size: Make editor text larger or smaller
- run_command: Execute shell commands (install packages, run scripts)
- git_commit_push: Commit and push to GitHub automatically
- search_code: Find patterns in the project

=== INSTRUCTIONS ===
1. When user asks you to DO something (create, write, fix, run, command, commit, delete, remove, folder, file, focus, close chat, dark mode, light mode, theme, dyslexia, pomodoro, font size, change language), USE A TOOL — don't just describe it
2. When user asks a question, answer in text
3. Always explain what you're about to do in simple, friendly language — in the {ui_language} language.
4. For neurodivergent users: be concise, clear, and step-by-step
5. After using a tool, explain what happened in {ui_language}.

=== REQUEST ===
User: {message}
"""

        client_actions = []
        server_results = []
        final_text = ""

        try:
            response = await asyncio.to_thread(
                self.model.generate_content, system_prompt
            )

            # Process function calls
            candidate = response.candidates[0]

            for part in candidate.content.parts:
                if hasattr(part, 'function_call') and part.function_call.name:
                    fc = part.function_call
                    tool_name = fc.name
                    tool_args = dict(fc.args)

                    # Server-side execution (git, terminal)
                    server_result = await execute_tool_server_side(tool_name, tool_args, repo_path)

                    if server_result.get("client_side"):
                        # Frontend will handle this action
                        client_actions.append({
                            "type": tool_name,
                            **tool_args
                        })
                    else:
                        server_results.append({
                            "tool": tool_name,
                            "result": server_result
                        })

                elif hasattr(part, 'text') and part.text:
                    final_text += part.text

        except Exception as e:
            # Fallback to plain chat if function calling fails
            fallback_model = genai.GenerativeModel(
                model_name="gemini-2.0-flash",
                generation_config={"temperature": 0.3, "max_output_tokens": 4096},
            )
            fallback_prompt = f"{context}\n\nUser: {message}\n\nRespond as AmbatuCode AI assistant."
            fallback_resp = await asyncio.to_thread(
                fallback_model.generate_content, fallback_prompt
            )
            final_text = fallback_resp.text.strip()

        # Return the response directly
        if not final_text and (client_actions or server_results):
            final_text = "Action completed."

        return {
            "message": final_text or "Done! Let me know if you need anything else.",
            "actions": client_actions,
            "server_results": server_results,
        }

    def _build_action_summary(self, client_actions: list, server_results: list) -> str:
        lines = []
        for action in client_actions:
            t = action.get("type")
            if t == "create_file":
                lines.append(f"✓ Created **{action.get('filename')}**")
            elif t == "insert_code":
                lines.append(f"✓ Inserted code into current file")
            elif t == "update_file":
                lines.append(f"✓ Updated current file")
            elif t == "search_code":
                lines.append(f"✓ Searching for: `{action.get('query')}`")

        for sr in server_results:
            t = sr.get("tool")
            r = sr.get("result", {})
            if t == "git_commit_push":
                if r.get("success"):
                    lines.append(f"✓ Pushed to GitHub → `{r.get('commit_message', '')}`")
                else:
                    lines.append(f"✗ Git push failed: {r.get('message', 'unknown error')}")
            elif t == "run_command":
                if r.get("success"):
                    out = r.get("stdout", "").strip()
                    lines.append(f"✓ Command executed" + (f":\n```\n{out[:300]}\n```" if out else ""))
                else:
                    lines.append(f"✗ Command failed: {r.get('stderr', '')[:200]}")

        return "\n".join(lines) if lines else ""
