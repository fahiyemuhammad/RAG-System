import os
from typing import List
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_openai import ChatOpenAI
from langchain_groq import ChatGroq
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_community.document_loaders import TextLoader

from vectordb import VectorDB

load_dotenv()

app = FastAPI(title="Lexis RAG Assistant API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def load_documents(documents_path: str = "./documents") -> List[str]:
    documents = []
    if not os.path.exists(documents_path):
        print(f"Warning: Documents path '{documents_path}' not found.")
        return documents
    for file in os.listdir(documents_path):
        if file.endswith(".txt"):
            file_path = os.path.join(documents_path, file)
            loader = TextLoader(file_path)
            docs = loader.load()
            documents.extend(docs)
    print(f"Loaded {len(documents)} documents")
    return [doc.page_content for doc in documents]


class RAGAssistant:
    def __init__(self):
        self.llm = self._initialize_llm()
        self.vector_db = VectorDB()
        self.prompt_template = ChatPromptTemplate.from_template(
            """You are Lexis, a knowledgeable and helpful research assistant.

Your job is to answer questions using the context provided below.
- If the context contains relevant information, give a clear, thorough answer.
- If the context only partially covers the question, answer what you can and note what is missing.
- Only say you don't have information if the context is completely unrelated to the question.
- Be conversational and helpful, avoid being overly cautious.

Context:
{context}

Question:
{question}

Answer:"""
        )
        self.chain = self.prompt_template | self.llm | StrOutputParser()
        print("Lexis RAG Assistant initialized")

    def _initialize_llm(self):
        if os.getenv("GROQ_API_KEY"):
            return ChatGroq(
                api_key=os.getenv("GROQ_API_KEY"),
                model=os.getenv("GROQ_MODEL", "llama-3.1-8b-instant"),
                temperature=0.2,
            )
        if os.getenv("OPENAI_API_KEY"):
            return ChatOpenAI(
                api_key=os.getenv("OPENAI_API_KEY"),
                model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
                temperature=0.2,
            )
        if os.getenv("GOOGLE_API_KEY"):
            return ChatGoogleGenerativeAI(
                google_api_key=os.getenv("GOOGLE_API_KEY"),
                model=os.getenv("GOOGLE_MODEL", "gemini-2.0-flash"),
                temperature=0.2,
            )
        raise ValueError("No valid LLM API key found in environment variables.")

    def add_documents(self, documents: List[str]) -> None:
        self.vector_db.add_documents(documents)

    def invoke(self, question: str, n_results: int = 5) -> str:
        results = self.vector_db.search(question, n_results=n_results)
        documents = results.get("documents", [])
        distances = results.get("distances", [])

        if not documents or not documents[0]:
            return "I could not find relevant information in the knowledge base."

        SIMILARITY_THRESHOLD = 1.5
        filtered_chunks = [
            doc for doc, dist in zip(documents[0], distances[0])
            if dist <= SIMILARITY_THRESHOLD
        ]

        if not filtered_chunks:
            filtered_chunks = documents[0][:3]

        context = "\n\n".join(filtered_chunks)
        return self.chain.invoke({"context": context, "question": question})


assistant: RAGAssistant | None = None


@app.on_event("startup")
async def startup_event():
    global assistant
    assistant = RAGAssistant()
    docs = load_documents()
    if docs:
        assistant.add_documents(docs)
    print("Lexis API ready!")


@app.get("/")
async def root():
    return {"message": "Lexis RAG Assistant API is running!"}


@app.get("/health")
async def health():
    return {"status": "ok"}


class QueryRequest(BaseModel):
    message: str


class QueryResponse(BaseModel):
    message: str


@app.post("/api/response", response_model=QueryResponse)
async def get_response(request: QueryRequest):
    if not assistant:
        raise HTTPException(status_code=503, detail="Assistant not ready yet.")
    if not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty.")
    answer = assistant.invoke(request.message)
    return QueryResponse(message=answer)


if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=int(os.getenv("PORT", 8000)), reload=False)