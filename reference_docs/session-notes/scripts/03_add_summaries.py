import re
from pathlib import Path
import logging

def setup_logging():
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )

def get_summaries(summary_file, session_num):
    """Get appropriate summaries for the given session"""
    with open(summary_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Find all level 1-3 summary sections
    summary_sections = []
    current_section = []
    current_session = None
    
    for line in content.split('\n'):
        # New session starts
        if line.startswith('**Session'):
            if current_session and current_section:
                summary_sections.append((current_session, '\n'.join(current_section)))
            current_section = []
            current_session = int(re.search(r'Session (\d+)', line).group(1))
        else:
            current_section.append(line)
    
    # Add the last section
    if current_session and current_section:
        summary_sections.append((current_session, '\n'.join(current_section)))
    
    # Build summaries based on session number
    summaries = []
    
    # Level 1 summaries for all sessions except the last two
    for i in range(1, max(1, session_num - 2)):
        for sess_num, content in summary_sections:
            if sess_num == i:
                level1_content = re.search(r'### Level 1 Summary(.*?)(?=###|$)', content, re.DOTALL)
                if level1_content:
                    summaries.append(f"## Summary of Session {i} (Level 1)\n{level1_content.group(1).strip()}\n")
    
    # Level 2 summary for session_num - 2
    if session_num > 2:
        for sess_num, content in summary_sections:
            if sess_num == session_num - 2:
                level2_content = re.search(r'### Level 2 Summary(.*?)(?=###|$)', content, re.DOTALL)
                if level2_content:
                    summaries.append(f"## Summary of Session {session_num - 2} (Level 2)\n{level2_content.group(1).strip()}\n")
    
    # Level 3 summary for session_num - 1
    if session_num > 1:
        for sess_num, content in summary_sections:
            if sess_num == session_num - 1:
                level3_content = re.search(r'### Level 3 Summary(.*?)(?=###|$)', content, re.DOTALL)
                if level3_content:
                    summaries.append(f"## Summary of Session {session_num - 1} (Level 3)\n{level3_content.group(1).strip()}\n")
    
    return "\n".join(summaries)

def add_summaries_to_file(filepath, summary_file):
    """Add appropriate summaries to a session file"""
    try:
        # Extract session number from filename
        session_num = int(re.search(r'Session(\d+)', filepath.name).group(1))
        
        # Read current content
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Get summaries
        summaries = get_summaries(summary_file, session_num)
        
        if summaries:
            # Combine content
            new_content = []
            
            # Keep the original header
            new_content.append(content.split('\n', 1)[0])  # First line (header)
            
            # Add summaries section
            new_content.extend([
                "",
                "# Previous Session Summaries",
                "",
                summaries,
                "",
                "# Current Session Content",
                "",
                content.split('\n', 1)[1]  # Rest of content
            ])
            
            # Write back to file
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write('\n'.join(new_content))
                
            logging.info(f"Added summaries to {filepath.name}")
            
    except Exception as e:
        logging.error(f"Error processing {filepath.name}: {e}")
        raise

def add_all_summaries():
    setup_logging()
    base_dir = Path(__file__).parent
    summary_file = base_dir / "summary_session_notes.md"
    
    # Process all session files in order
    for filepath in sorted(base_dir.glob("*-tts-stt-cursor-Session*.md")):
        add_summaries_to_file(filepath, summary_file)

if __name__ == "__main__":
    add_all_summaries() 