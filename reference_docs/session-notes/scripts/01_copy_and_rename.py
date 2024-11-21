import re
from pathlib import Path
import logging
import shutil

def setup_logging():
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )

def copy_and_rename_sessions(session_file):
    """
    1. Count first-level headers (#) in the file
    2. Create that many copies with proper naming including dates
    """
    setup_logging()
    
    try:
        logging.info(f"Reading file: {session_file}")
        
        # Read the file
        with open(session_file, 'r', encoding='utf-8') as f:
            lines = f.readlines()
            
        # Find lines starting with single # and extract dates
        session_lines = [(i, line.strip()) for i, line in enumerate(lines) if line.startswith('# ')]
        
        logging.info(f"Found {len(session_lines)} sessions")
        
        # Get the directory of the file
        base_dir = Path(session_file).parent
        
        # Create copies for each session
        for session_num, header_line in enumerate(session_lines, 1):
            # Extract date from header line
            date_match = re.search(r'(\d{4}-\d{2}-\d{2})', header_line[1])
            if date_match:
                date = date_match.group(1)
                new_filename = f"{date}-tts-stt-cursor-Session{session_num}.md"
            else:
                logging.warning(f"No date found in header: {header_line[1]}")
                new_filename = f"tts-stt-cursor-Session{session_num}.md"
                
            new_filepath = base_dir / new_filename
            
            # Copy the file
            shutil.copy2(session_file, new_filepath)
            logging.info(f"Created {new_filename}")
            
        logging.info("Finished creating session files")
        
    except Exception as e:
        logging.error(f"Error: {e}")
        raise

if __name__ == "__main__":
    script_dir = Path(__file__).parent
    session_file = script_dir / "session_notes.md"
    copy_and_rename_sessions(session_file) 