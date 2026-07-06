from pathlib import Path

import whisper # type: ignore
from pypdf import PdfReader


_whisper_model = None


def _get_whisper_model():
    # Getting whisper model
    global _whisper_model

    if _whisper_model is None:
        # Getting the base model
        _whisper_model = whisper.load_model("base", device="cpu")

    # Returning the model
    return _whisper_model


def extract_pdf_text(file_path: str, lesson_dir: str) -> str:
    # Initializing pdf reader for the selected file
    reader = PdfReader(file_path)

    # List to store text
    pages_text = []
    
    # looping over each page
    for page in reader.pages:
        # Extracting text
        text = page.extract_text()


        if text:
            # Adding text to list
            pages_text.append(text)

    # Converting the list into one string
    full_text = "\n\n".join(pages_text)

    # Creating the file path
    transcript_path = Path(lesson_dir) / "transcript.txt"

    # Writing the file
    transcript_path.write_text(full_text, encoding="utf-8")

    # Returning text
    return full_text


def extract_video_transcript(file_path: str, lesson_dir: str) -> str:
    # Getting whisper model
    model = _get_whisper_model()

    # Uploading video for transcript
    result = model.transcribe(file_path)

    # Getting full text
    full_text = result["text"].strip()

    # Creating the file path
    transcript_path = Path(lesson_dir) / "transcript.txt"

    # Writing the file
    transcript_path.write_text(full_text, encoding="utf-8")

    # Returning text
    return full_text
