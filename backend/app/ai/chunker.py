from langchain_text_splitters import RecursiveCharacterTextSplitter


def chunk_text(text: str) -> list[str]:
    # Splitting into 512 tokens with 50 tokens overlap to maintain context
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=512,
        chunk_overlap=50,
    )

    # Returning the splitted strings
    return splitter.split_text(text)