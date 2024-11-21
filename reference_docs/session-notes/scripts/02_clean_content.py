import re
from pathlib import Path
import logging

def setup_logging():
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )

def clean_session_file(filepath):
    """
    Remove content not relevant to the specific session.
    Uses the position of first-level headers to determine session boundaries.
    """
    try:
        # Read the file
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Extract session number from filename
        session_num = int(re.search(r'Session(\d+)', filepath.name).group(1))
        
        # Find all first-level headers
        header_positions = [(m.start(), m.group()) for m in re.finditer(r'^# ', content, re.MULTILINE)]
        
        if not header_positions:
            logging.error(f"No first-level headers found in {filepath.name}")
            return
            
        # Get the boundaries for this session
        # session_num - 1 because arrays are 0-based
        start_pos = header_positions[session_num - 1][0]
        
        # If this is the last session, go to end of file, otherwise to next header
        if session_num >= len(header_positions):
            end_pos = len(content)
        else:
            end_pos = header_positions[session_num][0]
        
        # Extract just this session's content
        session_content = content[start_pos:end_pos].strip()
        
        # Write back to file
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(session_content)
            
        logging.info(f"Cleaned {filepath.name}")
        
    except Exception as e:
        logging.error(f"Error processing {filepath.name}: {e}")
        raise

def clean_all_sessions():
    setup_logging()
    base_dir = Path(__file__).parent
    
    # Process all session files
    for filepath in sorted(base_dir.glob("*-tts-stt-cursor-Session*.md")):
        clean_session_file(filepath)

if __name__ == "__main__":
    clean_all_sessions() 