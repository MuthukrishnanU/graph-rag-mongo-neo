import os
from typing import TypedDict, Annotated, Sequence
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage
from langchain_openai import ChatOpenAI
from langchain_neo4j import Neo4jGraph, GraphCypherQAChain
from langgraph.graph import StateGraph, END
from dotenv import load_dotenv

load_dotenv()

# Define the state for the LangGraph
class AgentState(TypedDict):
    messages: Sequence[BaseMessage]
    context: str

# Initialize connections and LLM
def get_graph():
    kwargs = {
        "url": os.getenv("NEO4J_URI"),
        "username": os.getenv("NEO4J_USERNAME"),
        "password": os.getenv("NEO4J_PASSWORD")
    }
    
    db_name = os.getenv("NEO4J_DATABASE")
    if db_name:
        kwargs["database"] = db_name
        
    return Neo4jGraph(**kwargs)

def get_llm():
    return ChatOpenAI(temperature=0, model_name="gpt-4o")

def retrieve_from_graph(state: AgentState):
    """
    Retrieves context from Neo4j based on the latest user message.
    """
    messages = state["messages"]
    latest_message = messages[-1].content
    
    try:
        graph = get_graph()
        llm = get_llm()
        
        # We use GraphCypherQAChain to query the knowledge graph
        chain = GraphCypherQAChain.from_llm(
            graph=graph, 
            llm=llm, 
            verbose=True,
            return_direct=True # We just want the context/answer from the graph
        )
        
        response = chain.invoke({"query": latest_message})
        context = response.get("result", "No relevant information found in the graph.")
    except Exception as e:
        print(f"Error querying graph: {e}")
        context = "An error occurred while querying the knowledge graph."
        
    return {"context": context}

def generate_response(state: AgentState):
    """
    Generates a response using the LLM and the retrieved context.
    """
    messages = state["messages"]
    context = state.get("context", "")
    
    llm = get_llm()
    
    prompt = f"""You are a helpful Graph RAG chatbot specializing in banking policies.
Answer the user's question based on the following context retrieved from our knowledge graph:

<context>
{context}
</context>

If the context does not contain the answer, politely state that you don't know based on the available policies.

Question: {messages[-1].content}"""
    
    response = llm.invoke(prompt)
    
    return {"messages": messages + [response]}

# Build the LangGraph
workflow = StateGraph(AgentState)

# Add nodes
workflow.add_node("retrieve", retrieve_from_graph)
workflow.add_node("generate", generate_response)

# Add edges
workflow.set_entry_point("retrieve")
workflow.add_edge("retrieve", "generate")
workflow.add_edge("generate", END)

# Compile the graph
app = workflow.compile()

def process_chat(message: str) -> str:
    """
    Entry function to be called by FastAPI.
    """
    inputs = {"messages": [HumanMessage(content=message)]}
    result = app.invoke(inputs)
    return result["messages"][-1].content
