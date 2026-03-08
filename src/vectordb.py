import os
import chromadb
from typing import List, Dict, Any
from sentence_transformers import SentenceTransformer
from langchain_text_splitters import RecursiveCharacterTextSplitter


class VectorDB:
    def __init__(self, collection_name: str = None, embedding_model: str = None):
        self.collection_name = collection_name or os.getenv(
            "CHROMA_COLLECTION_NAME", "rag_documents"
        )
        self.embedding_model_name = embedding_model or os.getenv(
            "EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2"
        )

        # Use a path relative to this file so it works both locally and on Railway
        db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "chroma_db")
        self.client = chromadb.PersistentClient(path=db_path)

        print(f"Loading embedding model: {self.embedding_model_name}")
        self.embedding_model = SentenceTransformer(self.embedding_model_name)

        self.collection = self.client.get_or_create_collection(
            name=self.collection_name,
            metadata={"description": "RAG document collection"},
        )
        print(f"Vector DB ready — collection '{self.collection_name}' has {self.collection.count()} chunks")

    def is_populated(self) -> bool:
        """Returns True if the collection already has documents — skip re-ingestion."""
        return self.collection.count() > 0

    def chunk_text(self, text: str, doc_id: int) -> List[Dict[str, Any]]:
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200,
            separators=["\n\n", "\n", ". ", " ", ""],
        )
        chunks = splitter.split_text(text)
        return [
            {"content": chunk, "metadata": {"source_doc": doc_id, "chunk_index": i}}
            for i, chunk in enumerate(chunks)
        ]

    def add_documents(self, documents: List[str]) -> None:
        if self.is_populated():
            print(f"Collection already has {self.collection.count()} chunks — skipping ingestion.")
            return

        print(f"Processing {len(documents)} documents...")
        for doc_index, document in enumerate(documents):
            print(f"Chunking document {doc_index + 1}/{len(documents)}")
            chunks = self.chunk_text(document, doc_index)
            texts = [c["content"] for c in chunks]
            embeddings = self.embedding_model.encode(texts)
            ids = [f"doc_{doc_index}_chunk_{i}" for i in range(len(texts))]
            self.collection.add(
                documents=texts,
                embeddings=embeddings.tolist(),
                metadatas=[c["metadata"] for c in chunks],
                ids=ids,
            )
        print("Documents added to vector database successfully")

    def search(self, query: str, n_results: int = 5) -> Dict[str, Any]:
        query_embedding = self.embedding_model.encode([query])
        results = self.collection.query(
            query_embeddings=query_embedding.tolist(),
            n_results=min(n_results, self.collection.count() or 1),
            include=["documents", "metadatas", "distances"],
        )
        if not results or not results.get("documents"):
            return {"documents": [], "metadatas": [], "distances": [], "ids": []}
        return results