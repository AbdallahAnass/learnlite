import chromadb
from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction

_collection = None


def _get_collection():
    global _collection
    if _collection is None:
        # Getting the chrome db clint
        client = chromadb.PersistentClient(path="chroma_db")

        # Loading sentence transformer embedding (all-MiniLM-L6-v2)
        ef = SentenceTransformerEmbeddingFunction(model_name="all-MiniLM-L6-v2")

        # Creating collection
        _collection = client.get_or_create_collection(
            name="course_content",
            embedding_function=ef,
        )
    
    # Returning function
    return _collection


def index_lesson(lesson_id: int, course_id: int, lesson_title: str, chunks: list[str]) -> None:
    # Getting db collection
    collection = _get_collection()

    # Remove any previously indexed chunks for this lesson before re-indexing
    existing = collection.get(where={"lesson_id": lesson_id})
    if existing["ids"]:
        collection.delete(where={"lesson_id": lesson_id})

    # Storing chunks with lesson_id, course_id, and lesson_title
    ids = [f"lesson_{lesson_id}_chunk_{i}" for i in range(len(chunks))]
    metadatas = [
        {"lesson_id": lesson_id, "course_id": course_id, "lesson_title": lesson_title, "chunk_index": i}
        for i in range(len(chunks))
    ]

    # Adding chunk to chrome db
    collection.add(documents=chunks, metadatas=metadatas, ids=ids)


def delete_lesson_index(lesson_id: int) -> None:
    # Getting db collection
    collection = _get_collection()

    # Getting the chunks for the lesson
    existing = collection.get(where={"lesson_id": lesson_id})
    if existing["ids"]:
        # Deleing the chunks
        collection.delete(where={"lesson_id": lesson_id})
