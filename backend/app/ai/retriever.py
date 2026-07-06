from app.ai.embedder import _get_collection


def query_course(course_id: int, question: str, n_results: int = 5) -> list[dict]:
    collection = _get_collection()

    # Query ChromaDB filtered to this course only
    results = collection.query(
        query_texts=[question],
        n_results=n_results,
        where={"course_id": course_id},
    )

    # chunks list
    chunks = []

    # Getting the documents
    documents = results["documents"][0]

    # Getting documents metadata
    metadatas = results["metadatas"][0]

    # Adding each chunk with it's metadata to the list
    for text, meta in zip(documents, metadatas):
        chunks.append({
            "text": text,
            "lesson_title": meta["lesson_title"],
        })

    # Returning the list of chunks
    return chunks
