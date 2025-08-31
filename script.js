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
        // First try to get facts from our curated database
        const curatedFacts = this.getCuratedFacts(countryName);
        if (curatedFacts) {
            return curatedFacts;
        }
        
        // Try free AI API as fallback
        try {
            const prompt = `Tell me 3 interesting facts about ${countryName}:`;
            
            // Using a more reliable free text completion API
            const response = await fetch('https://api-inference.huggingface.co/models/gpt2', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    inputs: prompt,
                    parameters: {
                        max_length: 200,
                        temperature: 0.8,
                        do_sample: true,
                        return_full_text: false
                    }
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log('API Response:', data);
                
                if (data && data[0] && data[0].generated_text) {
                    return this.parseFactsFromText(data[0].generated_text, countryName);
                }
            }
        } catch (error) {
            console.warn('AI API failed, using fallback facts:', error);
        }
        
        // Ultimate fallback - generic educational facts
        return this.getGenericFacts(countryName);
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
    
    getCuratedFacts(countryName) {
        const country = countryName.toLowerCase();
        const factsDatabase = {
            'japan': [
                { title: "Vending Machine Paradise", content: "Japan has over 5 million vending machines, selling everything from hot coffee to fresh flowers - that's one vending machine for every 25 people!" },
                { title: "Ancient Meets Modern", content: "Japan has the world's oldest continuous monarchy, with Emperor Naruhito being the 126th emperor in an unbroken line dating back over 2,600 years." },
                { title: "Island Nation", content: "Japan consists of 6,852 islands, though only about 430 are inhabited, making it one of the most geographically complex countries in the world." }
            ],
            'france': [
                { title: "Cheese Champion", content: "France produces over 350 types of cheese, and it's said that you could eat a different French cheese every day for an entire year!" },
                { title: "Most Visited Country", content: "France is the world's most visited country, welcoming over 89 million tourists annually - more than its entire population!" },
                { title: "Time Zone Record", content: "France spans 12 different time zones, more than any other country, due to its overseas territories around the globe." }
            ],
            'brazil': [
                { title: "Amazon Powerhouse", content: "Brazil contains about 60% of the Amazon rainforest, which produces approximately 20% of the world's oxygen." },
                { title: "Coffee King", content: "Brazil has been the world's largest coffee producer for over 150 years, producing about one-third of all coffee globally." },
                { title: "Carnival Capital", content: "Rio de Janeiro's Carnival is the world's largest carnival celebration, attracting over 2 million people daily during the festival." }
            ],
            'egypt': [
                { title: "Ancient Wonder", content: "The Great Pyramid of Giza was the tallest man-made structure in the world for over 3,800 years until the Eiffel Tower was built." },
                { title: "Nile Lifeline", content: "The Nile River, flowing through Egypt, is the longest river in the world at 4,135 miles and has been Egypt's lifeline for over 5,000 years." },
                { title: "Hieroglyphic Legacy", content: "Ancient Egyptians used over 700 different hieroglyphic symbols, and the Rosetta Stone was the key to deciphering this ancient writing system." }
            ],
            'india': [
                { title: "Language Diversity", content: "India recognizes 22 official languages and has over 1,600 spoken languages, making it one of the most linguistically diverse countries on Earth." },
                { title: "Spice Origin", content: "India is known as the 'Spice Bowl of the World' and produces 70% of the world's spices, including black pepper, cardamom, and turmeric." },
                { title: "Chess Birthplace", content: "Chess was invented in India around the 6th century AD, originally called 'Chaturanga,' meaning 'four divisions of the army.'" }
            ],
            'italy': [
                { title: "Pasta Perfection", content: "Italy has over 350 different pasta shapes, each designed to pair perfectly with specific sauces and regional ingredients." },
                { title: "UNESCO Champion", content: "Italy has the most UNESCO World Heritage Sites of any country with 58 sites, showcasing its incredible historical and cultural wealth." },
                { title: "Volcano Land", content: "Italy has three active volcanoes: Mount Etna, Stromboli, and Mount Vesuvius, with Mount Etna being Europe's most active volcano." }
            ],
            'australia': [
                { title: "Unique Wildlife", content: "Australia is home to more than 80% of animals and plants that exist nowhere else on Earth, including kangaroos, koalas, and the platypus." },
                { title: "Massive Country", content: "Australia is the 6th largest country by land area but has a population of only 26 million people, making it one of the least densely populated countries." },
                { title: "Great Barrier Reef", content: "The Great Barrier Reef is the world's largest coral reef system and can be seen from space - it's larger than the Great Wall of China!" }
            ],
            'canada': [
                { title: "Freshwater Giant", content: "Canada has more freshwater than any other country, containing about 20% of the world's fresh water in its lakes and rivers." },
                { title: "Maple Syrup Monopoly", content: "Canada produces 71% of the world's maple syrup, with Quebec alone accounting for 90% of Canada's production." },
                { title: "Coastline Champion", content: "Canada has the world's longest coastline at 202,080 kilometers, longer than the coastlines of all other countries combined!" }
            ]
        };
        
        return factsDatabase[country] || null;
    }
    
    getGenericFacts(countryName) {
        const templates = [
            `${countryName} has a rich cultural heritage that reflects centuries of history and tradition.`,
            `The geography of ${countryName} offers diverse landscapes from mountains to valleys, each with unique characteristics.`,
            `${countryName} has made significant contributions to world culture, art, science, or international relations.`
        ];
        
        return templates.map((content, index) => ({
            title: `Cultural Heritage ${index + 1}`,
            content: content
        }));
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