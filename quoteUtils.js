// quoteUtils.js

/**
 * Returns a motivational trainer-style quote at random.
 * Each call returns a different quote for variety.
 */
function getQuoteOfTheDay() {
    const quotes = [
      "Consistency beats intensity every time.",
      "Earn your shower.",
      "Don’t count the days — make the days count.",
      "Every rep is a step closer to your goal.",
      "Train like you mean it.",
      "You are one workout away from a better mood.",
      "Show up. Even when you don’t feel like it.",
      "Discipline is stronger than motivation.",
      "Push hard. Recover harder.",
      "Your future self will thank you."
    ];
  
    const randomIndex = Math.floor(Math.random() * quotes.length);
    return quotes[randomIndex];
  }
  
  module.exports = { getQuoteOfTheDay };
  