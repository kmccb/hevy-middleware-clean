function getQuoteOfTheDay() {
    const quotes = [ ... ];
    return quotes[new Date().getDate() % quotes.length];
  }
  