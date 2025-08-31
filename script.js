class CountryFactsApp {
    constructor() {
        this.countries = [];
        this.initializeElements();
        this.loadCountriesList();
        this.attachEventListeners();
    }
    
    initializeElements() {
        this.countryInput = document.getElementById('countryInput');
        this.generateBtn = document.getElementById('generateBtn');
        this.generateMoreBtn = document.getElementById('generateMoreBtn');
        this.suggestionsContainer = document.getElementById('suggestions');
        this.loadingSpinner = document.getElementById('loadingSpinner');
        this.resultsSection = document.getElementById('resultsSection');
        this.countryTitle = document.getElementById('countryTitle');
        this.factsContainer = document.getElementById('factsContainer');
        this.errorMessage = document.getElementById('errorMessage');
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
    
    async generateFacts() {
        const countryName = this.countryInput.value.trim();
        
        if (!countryName) {
            this.showError('Please enter a country name');
            return;
        }
        
        this.showLoading();
        this.hideError();
        this.hideSuggestions();
        
        try {
            const facts = await this.fetchCountryFacts(countryName);
            this.displayFacts(countryName, facts);
        } catch (error) {
            console.error('Error generating facts:', error);
            if (error.message.includes('429')) {
                this.showError('Rate limit exceeded. Please wait a moment and try again.');
            } else if (error.message.includes('503')) {
                this.showError('Service temporarily unavailable. Please try again in a few seconds.');
            } else {
                this.showError('Failed to generate facts. Please try again.');
            }
        }
    }
    
    async fetchCountryFacts(countryName) {
        const prompt = `Generate 3 interesting fun facts about ${countryName}. Each fact should be educational and fascinating. Format as: 1. Fact one 2. Fact two 3. Fact three`;
        
        // Using Hugging Face Inference API with a free text generation model
        const response = await fetch('https://api-inference.huggingface.co/models/microsoft/DialoGPT-large', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                inputs: prompt,
                parameters: {
                    max_length: 200,
                    temperature: 0.8,
                    return_full_text: false
                }
            })
        });
        
        if (!response.ok) {
            // If DialoGPT doesn't work, try another free model
            const fallbackResponse = await fetch('https://api-inference.huggingface.co/models/gpt2', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    inputs: prompt,
                    parameters: {
                        max_length: 150,
                        temperature: 0.7,
                        return_full_text: false
                    }
                })
            });
            
            if (!fallbackResponse.ok) {
                throw new Error(`API request failed: ${response.status}`);
            }
            
            const fallbackData = await fallbackResponse.json();
            return this.parseFactsFromText(fallbackData[0].generated_text, countryName);
        }
        
        const data = await response.json();
        return this.parseFactsFromText(data[0].generated_text, countryName);
    }
    
    parseFactsFromText(text, countryName) {
        // Parse the generated text and create structured facts
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
        const facts = [];
        
        // Create 3 facts from the generated text
        for (let i = 0; i < 3 && i < sentences.length; i++) {
            const fact = sentences[i].trim();
            if (fact) {
                facts.push({
                    title: `Fact ${i + 1}`,
                    content: fact + (fact.endsWith('.') ? '' : '.')
                });
            }
        }
        
        // If we don't have enough facts, add some generic ones
        while (facts.length < 3) {
            const genericFacts = [
                `${countryName} has a unique cultural heritage that spans centuries.`,
                `The geography of ${countryName} offers diverse landscapes and natural wonders.`,
                `${countryName} has contributed significantly to world history and civilization.`,
                `The people of ${countryName} have rich traditions and customs.`,
                `${countryName} plays an important role in its region's economy and politics.`
            ];
            
            facts.push({
                title: `Interesting Fact`,
                content: genericFacts[facts.length] || `${countryName} is a fascinating country with much to discover.`
            });
        }
        
        return facts.slice(0, 3);
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