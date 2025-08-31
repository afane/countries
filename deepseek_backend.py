#!/usr/bin/env python3
"""
DeepSeek Country Facts Backend
A simple Flask API server that uses DeepSeek-R1 to generate country facts
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from transformers import pipeline
import json
import re
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Initialize DeepSeek pipeline
logger.info("Loading DeepSeek-R1 model...")
try:
    pipe = pipeline(
        "text-generation", 
        model="deepseek-ai/DeepSeek-R1", 
        trust_remote_code=True,
        device_map="auto",  # Automatically use GPU if available
        torch_dtype="auto"
    )
    logger.info("✅ DeepSeek-R1 model loaded successfully!")
except Exception as e:
    logger.error(f"❌ Failed to load DeepSeek model: {e}")
    pipe = None

def parse_facts_from_response(text, country_name):
    """Parse the AI response and extract structured facts"""
    logger.info(f"Parsing response: {text[:200]}...")
    
    facts = []
    
    # Try to find numbered facts (1., 2., 3.)
    numbered_pattern = r'(\d+)\.\s*([^:]+?)[:.]?\s*(.+?)(?=\d+\.|$)'
    matches = re.findall(numbered_pattern, text, re.MULTILINE | re.DOTALL)
    
    if matches:
        for i, (num, title, content) in enumerate(matches[:3]):
            facts.append({
                "title": title.strip(),
                "content": content.strip()
            })
    else:
        # Fallback: split by sentences and create facts
        sentences = [s.strip() for s in re.split(r'[.!?]+', text) if len(s.strip()) > 20]
        for i, sentence in enumerate(sentences[:3]):
            facts.append({
                "title": f"Interesting Fact {i+1}",
                "content": sentence + "." if not sentence.endswith('.') else sentence
            })
    
    # Ensure we have exactly 3 facts
    while len(facts) < 3:
        facts.append({
            "title": f"About {country_name}",
            "content": f"{country_name} has a rich history and culture worth exploring."
        })
    
    return facts[:3]

@app.route('/generate-facts', methods=['POST'])
def generate_facts():
    """Generate 3 interesting facts about a country using DeepSeek"""
    try:
        data = request.get_json()
        country_name = data.get('country', '').strip()
        
        if not country_name:
            return jsonify({"error": "Country name is required"}), 400
        
        logger.info(f"🌍 Generating facts for: {country_name}")
        
        if not pipe:
            return jsonify({"error": "DeepSeek model not available"}), 500
        
        # Create prompt for DeepSeek
        prompt = f"""Generate exactly 3 fascinating and unique facts about {country_name}. 
Format each fact as:
1. [Catchy Title]: [Interesting fact content]
2. [Catchy Title]: [Interesting fact content]  
3. [Catchy Title]: [Interesting fact content]

Make each fact educational, entertaining, and not commonly known. Focus on history, culture, geography, or unique characteristics."""

        messages = [
            {"role": "user", "content": prompt}
        ]
        
        # Generate response with DeepSeek
        logger.info("🤖 Calling DeepSeek model...")
        response = pipe(
            messages,
            max_new_tokens=300,
            temperature=0.8,
            do_sample=True,
            pad_token_id=pipe.tokenizer.eos_token_id
        )
        
        # Extract generated text
        if response and len(response) > 0:
            generated_text = response[0]['generated_text']
            
            # Get only the assistant's response (after the user message)
            if isinstance(generated_text, list):
                assistant_response = generated_text[-1]['content'] if generated_text[-1]['role'] == 'assistant' else str(generated_text)
            else:
                # Find the response after our prompt
                assistant_response = generated_text[len(prompt):].strip()
            
            logger.info(f"✅ Generated response: {assistant_response[:200]}...")
            
            # Parse the response into structured facts
            facts = parse_facts_from_response(assistant_response, country_name)
            
            logger.info(f"📄 Parsed {len(facts)} facts successfully")
            return jsonify({"facts": facts})
        
        else:
            logger.error("❌ No response from DeepSeek model")
            return jsonify({"error": "Failed to generate response"}), 500
            
    except Exception as e:
        logger.error(f"❌ Error generating facts: {str(e)}")
        return jsonify({"error": f"Internal server error: {str(e)}"}), 500

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    model_status = "available" if pipe else "unavailable"
    return jsonify({
        "status": "running",
        "model": "DeepSeek-R1",
        "model_status": model_status
    })

if __name__ == '__main__':
    print("🚀 Starting DeepSeek Country Facts Backend...")
    print("📡 Server will run on http://localhost:5000")
    print("🌍 Endpoint: POST /generate-facts")
    print("❤️  Health check: GET /health")
    print("")
    print("💡 Make sure to install requirements:")
    print("   pip install flask flask-cors transformers torch")
    print("")
    
    app.run(debug=True, host='0.0.0.0', port=5000)