class CountryFactsApp {
    constructor() {
        this.countries = [];
        this.initializeElements();
        this.loadCountriesList();
        this.attachEventListeners();
    }
    
    initializeElements() {
        this.apiKeyInput = document.getElementById('apiKeyInput');
        this.toggleApiKeyBtn = document.getElementById('toggleApiKey');
        this.countryInput = document.getElementById('countryInput');
        this.generateBtn = document.getElementById('generateBtn');
        this.generateMoreBtn = document.getElementById('generateMoreBtn');
        this.suggestionsContainer = document.getElementById('suggestions');
        this.loadingSpinner = document.getElementById('loadingSpinner');
        this.resultsSection = document.getElementById('resultsSection');
        this.countryTitle = document.getElementById('countryTitle');
        this.factsContainer = document.getElementById('factsContainer');
        this.errorMessage = document.getElementById('errorMessage');
        
        // Load API key from localStorage if exists
        const savedApiKey = localStorage.getItem('gemini_api_key');
        if (savedApiKey) {
            this.apiKeyInput.value = savedApiKey;
        }
    }
    
    async loadCountriesList() {
        try {
            const response = await fetch('https://restcountries.com/v3.1/all?fields=name');
            const data = await response.json();
            this.countries = data.map(country => country.name.common).sort();
        } catch (error) {
            console.warn('Could not load countries list for suggestions');
        }
    }
    
    attachEventListeners() {
        this.apiKeyInput.addEventListener('input', this.saveApiKey.bind(this));
        this.toggleApiKeyBtn.addEventListener('click', this.toggleApiKeyVisibility.bind(this));
        this.countryInput.addEventListener('input', this.handleInputChange.bind(this));
        this.countryInput.addEventListener('keypress', this.handleKeyPress.bind(this));
        this.generateBtn.addEventListener('click', this.generateFacts.bind(this));
        this.generateMoreBtn.addEventListener('click', this.generateFacts.bind(this));
        
        document.addEventListener('click', (e) => {
            if (!this.suggestionsContainer.contains(e.target) && e.target !== this.countryInput) {
                this.hideSuggestions();
            }
        });
    }
    
    handleInputChange() {
        const query = this.countryInput.value.trim();
        if (query.length < 2) {
            this.hideSuggestions();
            return;
        }
        
        const suggestions = this.countries
            .filter(country => country.toLowerCase().includes(query.toLowerCase()))
            .slice(0, 5);
            
        this.showSuggestions(suggestions);
    }
    
    handleKeyPress(e) {
        if (e.key === 'Enter') {
            this.generateFacts();
        }
    }
    
    showSuggestions(suggestions) {
        if (suggestions.length === 0) {
            this.hideSuggestions();
            return;
        }
        
        this.suggestionsContainer.innerHTML = suggestions
            .map(suggestion => `<div class="suggestion-item" data-country="${suggestion}">${suggestion}</div>`)
            .join('');
            
        this.suggestionsContainer.style.display = 'block';
        
        this.suggestionsContainer.querySelectorAll('.suggestion-item').forEach(item => {
            item.addEventListener('click', () => {
                this.countryInput.value = item.dataset.country;
                this.hideSuggestions();
                this.generateFacts();
            });
        });
    }
    
    hideSuggestions() {
        this.suggestionsContainer.style.display = 'none';
    }
    
    saveApiKey() {
        const apiKey = this.apiKeyInput.value.trim();
        if (apiKey) {
            localStorage.setItem('gemini_api_key', apiKey);
        } else {
            localStorage.removeItem('gemini_api_key');
        }
    }
    
    toggleApiKeyVisibility() {
        const isPassword = this.apiKeyInput.type === 'password';
        this.apiKeyInput.type = isPassword ? 'text' : 'password';
        this.toggleApiKeyBtn.textContent = isPassword ? '🙈' : '👁️';
        this.toggleApiKeyBtn.title = isPassword ? 'Hide API Key' : 'Show API Key';
    }

    async generateFacts() {
        const countryName = this.countryInput.value.trim();
        const apiKey = this.apiKeyInput.value.trim();
        
        if (!apiKey) {
            this.showError('Please enter your Gemini API key first');
            return;
        }
        
        if (!countryName) {
            this.showError('Please enter a country name');
            return;
        }
        
        this.showLoading();
        this.hideError();
        this.hideSuggestions();
        
        try {
            const facts = await this.fetchCountryFacts(countryName, apiKey);
            this.displayFacts(countryName, facts);
        } catch (error) {
            console.error('Error generating facts:', error);
            if (error.message.includes('403') || error.message.includes('API_KEY_INVALID')) {
                this.showError('Invalid API key. Please check your Gemini API key.');
            } else if (error.message.includes('400')) {
                this.showError('Bad request. Please try with a different country name.');
            } else if (error.message.includes('429')) {
                this.showError('Rate limit exceeded. Please wait a moment and try again.');
            } else if (error.message.includes('500')) {
                this.showError('Server error. Please try again in a few minutes.');
            } else {
                this.showError(`Error: ${error.message}`);
            }
        }
    }
    
    async fetchCountryFacts(countryName, apiKey) {
        
        const prompt = `Generate exactly 3 interesting and unique fun facts about ${countryName}. 
        Each fact should be:
        - Fascinating and not commonly known
        - Educational yet entertaining
        - Historically or culturally significant
        - Around 1-2 sentences long
        
        Format your response as a JSON array with exactly 3 objects, each having:
        - "title": A catchy title for the fact
        - "content": The actual fact content
        
        Example format:
        [
            {"title": "Ancient Wonder", "content": "This country has the world's oldest continuously operating library."},
            {"title": "Natural Marvel", "content": "It's home to a lake that changes color with the seasons."},
            {"title": "Cultural Treasure", "content": "The national dish was invented by accident in 1847."}
        ]`;
        
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }],
                generationConfig: {
                    temperature: 0.9,
                    maxOutputTokens: 1000,
                }
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('API Error:', response.status, errorData);
            throw new Error(`API request failed: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
        }
        
        const data = await response.json();
        console.log('API Response:', data); // For debugging
        
        if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
            throw new Error('Invalid response format from API');
        }
        
        const generatedText = data.candidates[0].content.parts[0].text;
        
        try {
            const jsonMatch = generatedText.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            throw new Error('No JSON found in response');
        } catch (parseError) {
            console.error('Failed to parse JSON:', generatedText);
            return [
                {
                    title: "Interesting Fact",
                    content: `Here's what I found about ${countryName}: ${generatedText.substring(0, 200)}...`
                }
            ];
        }
    }
    
    displayFacts(countryName, facts) {
        this.hideLoading();
        
        this.countryTitle.textContent = `🌍 ${countryName}`;
        
        this.factsContainer.innerHTML = facts.map((fact, index) => `
            <div class="fact-card" style="animation-delay: ${index * 0.2}s">
                <div class="fact-number">${index + 1}</div>
                <h3 class="fact-title">${fact.title}</h3>
                <p class="fact-content">${fact.content}</p>
            </div>
        `).join('');
        
        this.resultsSection.style.display = 'block';
        this.resultsSection.scrollIntoView({ behavior: 'smooth' });
    }
    
    showLoading() {
        this.loadingSpinner.style.display = 'block';
        this.resultsSection.style.display = 'none';
        this.generateBtn.disabled = true;
    }
    
    hideLoading() {
        this.loadingSpinner.style.display = 'none';
        this.generateBtn.disabled = false;
    }
    
    showError(message) {
        this.hideLoading();
        this.errorMessage.querySelector('p').textContent = message;
        this.errorMessage.style.display = 'block';
        setTimeout(() => {
            this.errorMessage.style.display = 'none';
        }, 5000);
    }
    
    hideError() {
        this.errorMessage.style.display = 'none';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new CountryFactsApp();
});