from pydantic import BaseModel
import pandas as pd
import numpy as np
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pandas as pd
import numpy as np
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
import os
import re
# --- Configuration (Paths relative to where app.py is located) ---
# Ensure these match the actual file/folder names in your 'my_recommender_api' directory
DATA_PATH = 'udemy_course_data.csv'
EMBEDDINGS_PATH = 'course_title_embeddings.npy'
MODEL_PATH = 'sentence_transformer_model' # Path to the saved SentenceTransformer model folder

# --- Initialize FastAPI App ---

app = FastAPI(
    title="Course Recommendation API",
    description="API for recommending Udemy courses based on user text queries.",
    version="1.0.0"
)

# --- CORS Middleware for frontend-backend communication ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Change this to your frontend's URL in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Global variables to load data and model once ---
# These will be populated when the FastAPI app starts up
df = None
course_title_embeddings = None
embedding_model = None
course_id_to_idx = None

# --- Pydantic model for request body validation ---
class RecommendationRequest(BaseModel):
    user_query: str
    num_recommendations: int = 5

# --- Function to load all necessary resources at API startup ---
@app.on_event("startup")
async def load_resources():
    global df, course_title_embeddings, embedding_model, course_id_to_idx

    print("Loading resources for the API...")
    try:
        # Load the dataset
        if not os.path.exists(DATA_PATH):
            raise FileNotFoundError(f"Dataset not found at: {DATA_PATH}")
        df = pd.read_csv(DATA_PATH)
        print(f"Loaded {len(df)} courses from {DATA_PATH}")

        # Load Sentence-BERT model
        if not os.path.exists(MODEL_PATH):
            print(f"Error: Model not found at {MODEL_PATH}. This is required for embeddings.")
            raise FileNotFoundError(f"Sentence-BERT model not found at: {MODEL_PATH}")
        embedding_model = SentenceTransformer(MODEL_PATH)
        print(f"Loaded Sentence-BERT model from {MODEL_PATH}")

        # Load course title embeddings
        if not os.path.exists(EMBEDDINGS_PATH):
            print(f"Error: Embeddings not found at {EMBEDDINGS_PATH}. They need to be pre-generated.")
            raise FileNotFoundError(f"Course embeddings not found at: {EMBEDDINGS_PATH}")
        course_title_embeddings = np.load(EMBEDDINGS_PATH)
        print(f"Loaded course embeddings from {EMBEDDINGS_PATH}")


        # Create mapping from course_id to index for quick lookup
        course_id_to_idx = {course_id: idx for idx, course_id in enumerate(df['course_id'].tolist())}
        print("All resources loaded successfully for API.")

    except Exception as e:
        print(f"Critical Error during resource loading: {e}")
        # Re-raise the exception to prevent the FastAPI app from starting if resources aren't loaded
        raise HTTPException(status_code=500, detail=f"Failed to load necessary resources: {e}")

# --- Recommendation Logic ---
def get_recommendations_from_text_query_internal(user_query: str, num_recommendations: int):
    """Internal function to get recommendations, used by the API endpoint."""
    cleaned_query = re.sub(r'[^a-zA-Z0-9\s]', '', user_query.lower())
    
    # Generate embedding for the user query using the loaded model
    query_embedding = embedding_model.encode([cleaned_query])[0].reshape(1, -1)

    # Calculate cosine similarity between the query embedding and all course title embeddings
    similarities = cosine_similarity(query_embedding, course_title_embeddings).flatten()

    # Get the indices of the top similar courses (sorted descending)
    similar_indices = similarities.argsort()[::-1]

    # Collect the top N recommendations
    recommended_indices = []
    for i in similar_indices:
        # Avoid recommending the exact same title as the query if it happens to be a course title
        # For general queries, we just take the top N most similar
        recommended_indices.append(i)
        if len(recommended_indices) == num_recommendations:
            break

    # Format recommendations for API response
    recommendations = []
    for rec_idx in recommended_indices:
        rec_course = df.iloc[rec_idx]
        recommendations.append({
            'course_id': int(rec_course['course_id']),
            'course_title': rec_course['course_title'],
            'url': rec_course['url'],
            'is_paid': bool(rec_course['is_paid']),
            'price': float(rec_course['price']), # Use float for price for broader compatibility
            'content_duration': rec_course['content_duration'],
            'level': rec_course['level'],
            'subject': rec_course['subject'],
            'similarity_score': float(similarities[rec_idx])
        })

    return recommendations

# --- API Endpoint Definition ---
@app.post("/recommend")
async def recommend_courses(request: RecommendationRequest):
    """
    Endpoint to get course recommendations based on a user's text query.
    Takes a JSON payload with 'user_query' and optional 'num_recommendations'.
    """
    print(f"Received recommendation request for query: '{request.user_query}'")
    try:
        recommendations = get_recommendations_from_text_query_internal(
            request.user_query, request.num_recommendations
        )
        return {"recommendations": recommendations}
    except Exception as e:
        print(f"Error during recommendation generation: {e}")
        # Return a 500 error if something goes wrong during prediction
        raise HTTPException(status_code=500, detail=f"Recommendation failed: {e}")

# Optional: Add a root endpoint for health check
@app.get("/")
async def read_root():
    return {"message": "Course Recommendation API is running!"}