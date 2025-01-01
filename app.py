from flask import Flask, request, jsonify,render_template, send_from_directory 
from PyPDF2 import PdfReader
from langchain_community.vectorstores import FAISS
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.text_splitter import RecursiveCharacterTextSplitter
import os
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain.prompts import PromptTemplate
from langchain.chains.question_answering import load_qa_chain
from dotenv import load_dotenv
import fitz  
from concurrent.futures import ThreadPoolExecutor
import google.generativeai as genai
import tempfile
import shutil

# Initialize Flask app
app = Flask (__name__)
UPLOAD_FOLDER = 'uploads/pdfs'
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Load environment variables
load_dotenv()
genai.configure(api_key=os.getenv("GOOGLE_GEMINI_API_KEY"))

# Store chat history in memory (use a database for persistent storage in production)
chat_history = []

# =================
# HELPER FUNCTIONS
# =================


# for extracting text from pdf

def extract_text_from_pdf(pdf_path):
    """Extract text from a single PDF using PyMuPDF."""
    text = ""
    try:
        with fitz.open(pdf_path) as doc:
            for page in doc:
                text += page.get_text()
    except Exception as e:
        return f"Error processing {pdf_path}: {e}"
    return text


def get_pdf_text(pdf_docs):
    """Extract text from multiple PDFs in parallel."""
    with ThreadPoolExecutor() as executor:
        texts = list(executor.map(extract_text_from_pdf, pdf_docs))
    combined_text = " ".join(texts)
    if not combined_text.strip():
        raise ValueError("No text was extracted from the uploaded PDFs.")
    return combined_text

# get chunks
def get_chunks(text):
    """Split text into manageable chunks."""
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=2000, chunk_overlap=200)
    chunks = text_splitter.split_text(text)
    if not chunks:
        raise ValueError("No text chunks were generated. Please check the input text.")
    return chunks

# create vectore store
def get_vector_store(text_chunks):
    """Generate FAISS vector store from text chunks."""
    if not text_chunks:
        raise ValueError("No text chunks provided for vector store creation.")
    
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "\\M.Fest\\gen-lang-client-0718220959-c5cd76723902.json"
    embeddings = GoogleGenerativeAIEmbeddings(model="models/embedding-001")

    vector_store = FAISS.from_texts(text_chunks, embedding=embeddings)
    vector_store.save_local("faiss_index")

# load vector store
def load_vector_store():
    """Load the pre-saved FAISS vector store."""
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "\\M.Fest\\gen-lang-client-0718220959-c5cd76723902.json"
    embeddings = GoogleGenerativeAIEmbeddings(model="models/embedding-001")
    return FAISS.load_local("faiss_index", embeddings, allow_dangerous_deserialization=True)

# chain for retrieval
def get_conversational_chain():
    """Setup a conversational chain with context support."""
    prompt_template = """
    You are an intelligent assistant answering questions based on content from uploaded PDFs.
    Include relevant examples to support your responses, citing the page and document name.
    You can do meaningful and normal conversation with the user.
    Give the answer in the user's input language.

    ### Context:
    {context}

    ### User Question:
    {question}

    ### Answer:
    """
    model = ChatGoogleGenerativeAI(model="gemini-pro", temperature=0.3)
    prompt = PromptTemplate(template=prompt_template, input_variables=["context", "question"])
    return load_qa_chain(model, chain_type="stuff", prompt=prompt)

# user question' store in database
def query_pdf(user_question):
    """Query the FAISS vector store for relevant examples and generate a response."""
    vector_store = load_vector_store()
    docs = vector_store.similarity_search(user_question, k=3)
    if not docs:
        return "No relevant examples found.", []

    # Create context from retrieved documents
    context = "\n".join([f"Document: {doc.metadata.get('source', 'Unknown')}\nContent: {doc.page_content}" for doc in docs])

    # Add session chat history for context
    for entry in chat_history:
        context += f"\nUser: {entry['user']}\nBot: {entry['bot']}"

    # Generate response
    chain = get_conversational_chain()
    response = chain({"input_documents": docs, "context": context, "question": user_question}, return_only_outputs=True)

    # Save to chat history
    chat_history.append({"user": user_question, "bot": response["output_text"]})
    return response["output_text"], docs

# =================
# FLASK ENDPOINTS
# =================

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/app", endpoint="app_view")
def app_view():
    return render_template("mainpage.html")


@app.route('/upload_pdfs', methods=['POST'])
def upload_pdfs():
    """Endpoint to upload and process PDFs."""
    uploaded_files = request.files.getlist("pdfs")
    if not uploaded_files:
        return jsonify({"error": "No files uploaded"}), 400

    # Save PDFs to a temporary directory
    temp_dir = tempfile.mkdtemp()
    pdf_paths = []
    try:
        for file in uploaded_files:
            file_path = os.path.join(temp_dir, file.filename)
            file.save(file_path)
            pdf_paths.append(file_path)

        # Process PDFs
        raw_text = get_pdf_text(pdf_paths)
        text_chunks = get_chunks(raw_text)
        get_vector_store(text_chunks)
        return jsonify({"message": "PDFs uploaded successfully!"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        shutil.rmtree(temp_dir)  # Clean up temporary directory

@app.route('/ask', methods=['POST'])
def ask_question():
    """Endpoint to ask a question and get a response."""
    data = request.get_json()
    user_question = data.get("question")
    if not user_question:
        return jsonify({"error": "Question is required"}), 400

    try:
        response, docs = query_pdf(user_question)
        return jsonify({
            "response": response,
            "examples": [{"source": doc.metadata.get("source", "Unknown"), "content": doc.page_content[:500]} for doc in docs]
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/history', methods=['GET', 'DELETE'])
def manage_history():
    """Endpoint to view or clear chat history."""
    if request.method == 'GET':
        return jsonify({"chat_history": chat_history}), 200
    elif request.method == 'DELETE':
        chat_history.clear()
        return jsonify({"message": "Chat history cleared"}), 200


@app.route('/get_uploaded_pdfs', methods=['GET'])
def get_uploaded_pdfs():
    try:
        pdf_files = os.listdir(app.config['UPLOAD_FOLDER'])
        uploaded_pdfs = [{'text': pdf, 'url': f'/uploads/pdfs/{pdf}'} for pdf in pdf_files if pdf.endswith('.pdf')]
        return jsonify({'uploaded_pdfs': uploaded_pdfs})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/uploads/pdfs/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)


@app.route('/delete_pdf/<pdf_name>', methods=['DELETE'])
def delete_pdf(pdf_name):
    try:
        pdf_path = os.path.join(app.config['UPLOAD_FOLDER'], pdf_name)
        if os.path.exists(pdf_path):
            os.remove(pdf_path)
            return jsonify({'message': f'PDF {pdf_name} deleted successfully!'})
        else:
            return jsonify({'error': 'PDF not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True)