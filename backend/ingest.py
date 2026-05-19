import os
import time
from dotenv import load_dotenv
from pymongo import MongoClient
from langchain_neo4j import Neo4jGraph
from langchain_openai import ChatOpenAI
from langchain_experimental.graph_transformers import LLMGraphTransformer
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME")
MONGO_COLLECTION_NAME = os.getenv("MONGO_COLLECTION_NAME")

NEO4J_URI = os.getenv("NEO4J_URI")
NEO4J_USERNAME = os.getenv("NEO4J_USERNAME")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD")
NEO4J_DATABASE = os.getenv("NEO4J_DATABASE") # Can be None, let Neo4j driver use default

def ingest_from_mongo_to_neo4j():
    if not MONGO_URI or not MONGO_DB_NAME or not MONGO_COLLECTION_NAME:
        print("MongoDB environment variables are missing. Please check your .env file.")
        return

    print("Connecting to MongoDB...")
    try:
        mongo_client = MongoClient(MONGO_URI)
        db = mongo_client[MONGO_DB_NAME]
        collection = db[MONGO_COLLECTION_NAME]
        
        # Fetch all documents
        # Adjust the field name below based on your actual document structure
        mongo_docs = list(collection.find({}))
        print(f"Fetched {len(mongo_docs)} documents from MongoDB.")
        
        if not mongo_docs:
            print("No documents found to ingest.")
            return

        documents = []
        for doc in mongo_docs:
            content = doc.get("text", doc.get("content", str(doc)))
            # Convert ObjectId to string and exclude large non-metadata fields if any
            metadata = {k: str(v) for k, v in doc.items() if k not in ["text", "content"]}
            documents.append(Document(page_content=content, metadata=metadata))
            
        # Chunk documents to prevent LLM rate limits and improve graph extraction
        text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
        chunked_docs = text_splitter.split_documents(documents)
        print(f"Split documents into {len(chunked_docs)} chunks.")
            
    except Exception as e:
        print(f"Error connecting to MongoDB: {e}")
        return

    print("Connecting to Neo4j...")
    try:
        kwargs = {
            "url": NEO4J_URI,
            "username": NEO4J_USERNAME,
            "password": NEO4J_PASSWORD,
        }
        if NEO4J_DATABASE:
            kwargs["database"] = NEO4J_DATABASE
            
        graph = Neo4jGraph(**kwargs)
    except Exception as e:
        print(f"Error connecting to Neo4j: {e}")
        return

    print("Initializing LLM for Graph Extraction...")
    # Make sure OPENAI_API_KEY is set in environment
    llm = ChatOpenAI(temperature=0, model_name="gpt-4o")
    
    # Use LLMGraphTransformer to convert documents into graph nodes and relationships
    llm_transformer = LLMGraphTransformer(llm=llm)
    
    print("Extracting graph elements (this may take a while)...")
    try:
        graph_documents = []
        for i, chunk in enumerate(chunked_docs):
            print(f"Processing chunk {i+1}/{len(chunked_docs)}...")
            try:
                res = llm_transformer.convert_to_graph_documents([chunk])
                graph_documents.extend(res)
                # Sleep to prevent hitting OpenAI's Tokens Per Minute (TPM) limit
                time.sleep(3) 
            except Exception as chunk_error:
                print(f"Rate limit or error on chunk {i+1}: {chunk_error}")
                print("Sleeping for 15 seconds before continuing...")
                time.sleep(15)

        print(f"Extracted {len(graph_documents)} graph document(s).")
        
        print("Adding graph documents to Neo4j...")
        graph.add_graph_documents(
            graph_documents, 
            baseEntityLabel=True, 
            include_source=True
        )
        print("Ingestion complete!")
    except Exception as e:
        print(f"Error during graph extraction/ingestion: {e}")

if __name__ == "__main__":
    ingest_from_mongo_to_neo4j()
