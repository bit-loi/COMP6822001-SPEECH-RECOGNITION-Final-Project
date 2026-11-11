def save_working_memory(user_id: str, context: dict) -> dict:
    """
    Save the working memory of the active session.
    
    Args:
        user_id: The ID of the user.
        context: The current context to save.
    """
    return {"status": "success", "user_id": user_id, "action": "saved working memory", "context": context}

def get_working_memory(user_id: str) -> dict:
    """
    Retrieve the last context for the user - useful for 'Where was I?'.
    
    Args:
        user_id: The ID of the user.
    """
    return {"status": "success", "user_id": user_id, "context": {}}

def save_long_term_pattern(user_id: str, pattern: dict) -> dict:
    """
    Save coding patterns and preferences for long-term use.
    
    Args:
        user_id: The ID of the user.
        pattern: The pattern data to save.
    """
    return {"status": "success", "user_id": user_id, "action": "saved long-term pattern"}
