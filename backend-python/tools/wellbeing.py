def log_emotional_state(user_id: str, state: str, trigger: str) -> dict:
    """
    Log the user's emotional state (e.g. frustrated, flow, confused).
    
    Args:
        user_id: The ID of the user.
        state: Emotion state like 'frustrated', 'flow', 'confused'.
        trigger: What triggered this emotion.
    """
    return {"status": "success", "user_id": user_id, "state": state, "trigger": trigger}

def get_wellbeing_summary(user_id: str) -> dict:
    """
    Get a summary of wellbeing: session duration, break frequency, focus score.
    
    Args:
        user_id: The ID of the user.
    """
    return {"status": "success", "summary": {}}

def trigger_break_reminder(user_id: str, session_minutes: int) -> dict:
    """
    Trigger a break notification if hyperfocus is detected.
    
    Args:
        user_id: The ID of the user.
        session_minutes: Duration of current session in minutes.
    """
    return {"status": "success", "reminder_triggered": True, "session_minutes": session_minutes}
