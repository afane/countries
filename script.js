class CountryFactsApp {
    constructor() {
      // Change this if your backend is hosted elsewhere
      this.API_BASE = "http://localhost:5002";
  
      this.countries = [];
      this.currentCountry = null;
      this.currentModelUsed = "Backend";
      // Hugging Face direct mode settings
      this.hf = {
        token: localStorage.getItem("hf_token") || "",
        enabled: localStorage.getItem("hf_enabled") === "1",
        model: "microsoft/Phi-3-mini-4k-instruct"
      };
  
      this.initEls();
      this.loadCountriesList();
      this.bindEvents();
      // Initialize HF UI controls
      if (this.hfTokenInput) this.hfTokenInput.value = this.hf.token ? "••••••••" : "";
      if (this.useHfDirect) this.useHfDirect.checked = this.hf.enabled;
      this.updatePowerSource();
    }
  
    initEls() {
      this.countryInput = document.getElementById("countryInput");
      this.generateBtn = document.getElementById("generateBtn");
      this.generateMoreBtn = document.getElementById("generateMoreBtn");
      this.suggestions = document.getElementById("suggestions");
      this.loading = document.getElementById("loadingSpinner");
      this.results = document.getElementById("resultsSection");
      this.countryTitle = document.getElementById("countryTitle");
      this.factsContainer = document.getElementById("factsContainer");
      this.errorBox = document.getElementById("errorMessage");
      this.hfTokenInput = document.getElementById("hfTokenInput");
      this.useHfDirect = document.getElementById("useHfDirect");
      this.saveHfBtn = document.getElementById("saveHfBtn");
      this.powerSource = document.getElementById("powerSource");
    }
  
    async loadCountriesList() {
      try {
        const r = await fetch("https://restcountries.com/v3.1/all?fields=name");
        const data = await r.json();
        this.countries = data.map(c => c.name.common).sort();
      } catch {
        // Suggestions are optional
      }
    }
  
    bindEvents() {
      this.countryInput.addEventListener("input", () => this.onInput());
      this.countryInput.addEventListener("keypress", e => {
        if (e.key === "Enter") this.generateFacts();
      });
      this.generateBtn.addEventListener("click", () => this.generateFacts());
      this.generateMoreBtn.addEventListener("click", () => this.generateFacts());
      document.addEventListener("click", e => {
        if (!this.suggestions.contains(e.target) && e.target !== this.countryInput) {
          this.hideSuggestions();
        }
      });

      if (this.saveHfBtn) {
        this.saveHfBtn.addEventListener("click", () => {
          const raw = (this.hfTokenInput && this.hfTokenInput.value) || "";
          if (raw && raw !== "••••••••") {
            this.hf.token = raw.trim();
            localStorage.setItem("hf_token", this.hf.token);
            if (this.hfTokenInput) this.hfTokenInput.value = "••••••••";
          }
          if (this.useHfDirect) {
            this.hf.enabled = !!this.useHfDirect.checked;
            localStorage.setItem("hf_enabled", this.hf.enabled ? "1" : "0");
          }
          this.updatePowerSource();
          this.showHint("Settings saved");
        });
      }
    }
  
    onInput() {
      const q = this.countryInput.value.trim();
      if (q.length < 2) return this.hideSuggestions();
  
      const list = this.countries
        .filter(c => c.toLowerCase().includes(q.toLowerCase()))
        .slice(0, 5);
  
      if (list.length === 0) return this.hideSuggestions();
  
      this.suggestions.innerHTML = list
        .map(name => `<div class="suggestion-item" data-country="${name}">${name}</div>`)
        .join("");
      this.suggestions.style.display = "block";
  
      this.suggestions.querySelectorAll(".suggestion-item").forEach(el => {
        el.addEventListener("click", () => {
          this.countryInput.value = el.dataset.country;
          this.hideSuggestions();
          this.generateFacts();
        });
      });
    }
  
    hideSuggestions() {
      this.suggestions.style.display = "none";
    }
  
    showLoading() {
      this.loading.style.display = "block";
      this.results.style.display = "none";
      this.generateBtn.disabled = true;
    }
  
    hideLoading() {
      this.loading.style.display = "none";
      this.generateBtn.disabled = false;
    }
  
    showError(msg) {
      this.hideLoading();
      this.errorBox.querySelector("p").textContent = msg;
      this.errorBox.style.display = "block";
      setTimeout(() => (this.errorBox.style.display = "none"), 4000);
    }
  
    async generateFacts() {
      const country = this.countryInput.value.trim();
      if (!country) return this.showError("Please enter a country name");
  
      this.showLoading();
      this.hideSuggestions();
  
      try {
        const facts = await this.fetchCountryFacts(country);
        if (!Array.isArray(facts) || facts.length === 0) {
          throw new Error("No facts returned");
        }
        this.renderFacts(country, facts);
      } catch (e) {
        this.showError(`Failed to generate facts: ${e.message}`);
      }
    }
  
    async fetchCountryFacts(country) {
      if (this.hf.enabled) {
        const facts = await this.hfGenerateFacts(country);
        this.currentModelUsed = "Phi-3-mini (Hugging Face)";
        this.updatePowerSource();
        return facts;
      }

      const resp = await fetch(`${this.API_BASE}/generate-facts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ country })
      });

      if (!resp.ok) {
        if (resp.status === 429) throw new Error("429 rate limit");
        if (resp.status === 503) throw new Error("503 service unavailable");
        throw new Error(`Backend error ${resp.status}`);
      }

      const data = await resp.json();
      this.currentModelUsed = data.model_used || "Backend";
      this.updatePowerSource();
      return data.facts;
    }
  
    renderFacts(country, facts) {
      this.hideLoading();
      this.currentCountry = country;
  
      this.countryTitle.textContent = `🌍 ${country}`;
  
      const cards = facts
        .map(
          (f, i) => `
        <div class="fact-card" style="animation-delay:${i * 0.15}s">
          <div class="fact-number">${i + 1}</div>
          <h3 class="fact-title">${this.escape(f.title || `Fact ${i + 1}`)}</h3>
          <p class="fact-content">${this.escape(f.content || "")}</p>
        </div>`
        )
        .join("");
  
      const chat = `
        <div class="model-info">
          <p>Generated by: <strong>${this.escape(this.currentModelUsed)}</strong></p>
        </div>
        <div class="chat-section">
          <h3>Ask a follow up about ${this.escape(country)}:</h3>
          <div class="chat-input-group">
            <input id="chatInput" class="chat-input" type="text" placeholder="Ask anything about ${this.escape(country)}..."/>
            <button id="askBtn" class="ask-btn">Ask</button>
          </div>
          <div id="chatResponse" class="chat-response" style="display:none;"></div>
        </div>
      `;
  
      this.factsContainer.innerHTML = cards + chat;
      this.results.style.display = "block";
      this.attachChat();
      this.results.scrollIntoView({ behavior: "smooth" });
    }
  
    attachChat() {
      const chatInput = document.getElementById("chatInput");
      const askBtn = document.getElementById("askBtn");
      const chatResponse = document.getElementById("chatResponse");
  
      const ask = async () => {
        const q = chatInput.value.trim();
        if (!q || !this.currentCountry) return;
  
        askBtn.disabled = true;
        askBtn.textContent = "Asking...";
        chatResponse.style.display = "block";
        chatResponse.innerHTML = '<div class="loading-dots">Thinking...</div>';
  
        try {
          let text, model;
          if (this.hf.enabled) {
            const reply = await this.hfChat(this.currentCountry, q);
            text = this.escape(reply || "No answer");
            model = this.escape("Phi-3-mini (Hugging Face)");
          } else {
            const r = await fetch(`${this.API_BASE}/chat`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ country: this.currentCountry, question: q })
            });
            if (!r.ok) throw new Error(`Backend error ${r.status}`);
            const data = await r.json();
            text = this.escape(data.response || "No answer");
            model = this.escape(data.model_used || "Backend");
          }
  
          chatResponse.innerHTML = `
            <div class="chat-answer">
              <strong>Answer:</strong> ${text}
              <div class="chat-model-info">Source: ${model}</div>
            </div>
          `;
          chatInput.value = "";
        } catch (e) {
          chatResponse.innerHTML = '<div class="chat-error">Could not get an answer.</div>';
        }
  
        askBtn.disabled = false;
        askBtn.textContent = "Ask";
      };
  
      askBtn.addEventListener("click", ask);
      chatInput.addEventListener("keypress", e => {
        if (e.key === "Enter") ask();
      });
    }
  
    escape(s) {
      return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    }

    updatePowerSource() {
      if (!this.powerSource) return;
      this.powerSource.textContent = `Powered by: ${this.hf.enabled ? "Hugging Face (Phi-3-mini)" : "Backend"}`;
    }

    showHint(msg) {
      this.errorBox.querySelector("p").textContent = msg;
      this.errorBox.style.display = "block";
      setTimeout(() => (this.errorBox.style.display = "none"), 1500);
    }

    // ===== Hugging Face Direct =====
    hfHeaders() {
      if (!this.hf.token) throw new Error("Missing Hugging Face token");
      return {
        "Authorization": `Bearer ${this.hf.token}`,
        "Content-Type": "application/json"
      };
    }

    async hfGenerate(prompt, parameters = {}) {
      if (!this.hf.enabled) throw new Error("HF direct mode disabled");
      const url = `https://api-inference.huggingface.co/models/${this.hf.model}?wait_for_model=true`;
      const resp = await fetch(url, {
        method: "POST",
        headers: this.hfHeaders(),
        body: JSON.stringify({
          inputs: prompt,
          parameters: Object.assign({
            max_new_tokens: 384,
            temperature: 0.7,
            top_p: 0.95,
            repetition_penalty: 1.05
          }, parameters)
        })
      });
      if (!resp.ok) {
        if (resp.status === 401) throw new Error("Invalid Hugging Face token");
        if (resp.status === 403) throw new Error("Model access denied or gated");
        if (resp.status === 429) throw new Error("Hugging Face rate limit");
        throw new Error(`HF error ${resp.status}`);
      }
      const data = await resp.json();
      if (Array.isArray(data) && data.length > 0 && data[0].generated_text) return data[0].generated_text;
      if (data && data.generated_text) return data.generated_text;
      if (Array.isArray(data) && data.length && data[0].token) return data.map(t => (t.token && t.token.text) || "").join("");
      return typeof data === "string" ? data : JSON.stringify(data);
    }

    async hfGenerateFacts(country) {
      if (!this.hf.token) throw new Error("Please set your Hugging Face token");
      const prompt = `You are Phi-3-mini, an instruct model.\nTask: Produce 4 concise, interesting, factual country facts about ${country}.\nOutput MUST be a valid JSON array of 4 objects with keys: title (max 8 words) and content (max 30 words). No extra commentary.\nExample:\n[\n  {"title":"Brief Title","content":"Short factual sentence."},\n  {"title":"...","content":"..."},\n  {"title":"...","content":"..."},\n  {"title":"...","content":"..."}\n]`;
      const text = await this.hfGenerate(prompt, { max_new_tokens: 420, temperature: 0.6 });
      const facts = this.extractJsonArray(text);
      if (!facts || !Array.isArray(facts) || facts.length === 0) {
        throw new Error("HF returned no parsable facts");
      }
      return facts.slice(0, 4).map((f, i) => ({
        title: (f && f.title) ? String(f.title) : `Fact ${i + 1}`,
        content: (f && f.content) ? String(f.content) : ""
      }));
    }

    async hfChat(country, question) {
      if (!this.hf.token) throw new Error("Please set your Hugging Face token");
      const prompt = `You are Phi-3-mini, a helpful assistant.\nAnswer concisely (1-3 sentences) and be specific to the country.\nCountry: ${country}\nQuestion: ${question}\nAnswer:`;
      const text = await this.hfGenerate(prompt, { max_new_tokens: 220, temperature: 0.7 });
      return text.trim();
    }

    extractJsonArray(text) {
      try { return JSON.parse(text); } catch {}
      try {
        const start = text.indexOf("[");
        const end = text.lastIndexOf("]");
        if (start !== -1 && end !== -1 && end > start) {
          return JSON.parse(text.slice(start, end + 1));
        }
      } catch {}
      return null;
    }
  }
  
  document.addEventListener("DOMContentLoaded", () => new CountryFactsApp());
  
