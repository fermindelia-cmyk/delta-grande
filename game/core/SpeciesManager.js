/**
 * SpeciesManager
 * Manages species data and progression through rounds/stages
 */

const SAVE_KEY = 'deltaPlus.speciesProgress.v1';

export class SpeciesManager {
  constructor() {
    this.speciesData = null;
    this.currentRound = 1;
    this.currentStage = 1;
    this.foundSpeciesIds = new Set();
    this.loadProgress(); // Load saved progress on initialization
  }

  /**
   * Load species data from JSON
   */
  async load() {
    const response = await fetch('./data/especies.json', { cache: 'no-store' });
    this.speciesData = await response.json();
    return this.speciesData;
  }

  /**
   * Save progress to localStorage
   */
  saveProgress() {
    const progress = {
      currentRound: this.currentRound,
      currentStage: this.currentStage,
      foundSpeciesIds: Array.from(this.foundSpeciesIds)
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(progress));
    console.log('[SpeciesManager] Progress saved:', progress);
  }

  /**
   * Load progress from localStorage
   */
  loadProgress() {
    try {
      const saved = localStorage.getItem(SAVE_KEY);
      if (saved) {
        const progress = JSON.parse(saved);
        this.currentRound = progress.currentRound || 1;
        this.currentStage = progress.currentStage || 1;
        this.foundSpeciesIds = new Set(progress.foundSpeciesIds || []);
        console.log('[SpeciesManager] Progress loaded:', progress);
      }
    } catch (e) {
      console.warn('[SpeciesManager] Failed to load progress:', e);
    }
  }

  /**
   * Get species for a specific round and stage
   */
  getSpecies(round, stage) {
    if (!this.speciesData) {
      console.error('[SpeciesManager] Species data not loaded');
      return null;
    }
    return this.speciesData.species.find(
      s => s.round === round && s.stage === stage
    );
  }

  /**
   * Get current species based on currentRound and currentStage
   */
  getCurrentSpecies() {
    return this.getSpecies(this.currentRound, this.currentStage);
  }

  /**
   * Get all species for a specific round
   */
  getSpeciesForRound(round) {
    if (!this.speciesData) return [];
    return this.speciesData.species.filter(s => s.round === round);
  }

  /**
   * Mark species as found
   */
  markSpeciesFound(speciesId) {
    this.foundSpeciesIds.add(speciesId);
    this.saveProgress(); // Save after marking species
  }

  /**
   * Check if species has been found
   */
  isSpeciesFound(speciesId) {
    return this.foundSpeciesIds.has(speciesId);
  }

  /**
   * Get all found species IDs for a round
   */
  getFoundSpeciesInRound(round) {
    const roundSpecies = this.getSpeciesForRound(round);
    return roundSpecies.filter(s => this.isSpeciesFound(s.id));
  }

  /**
   * Clear all found species for the current round
   * Used when player wants to restart the current round
   */
  clearCurrentRoundProgress() {
    const roundSpecies = this.getSpeciesForRound(this.currentRound);
    roundSpecies.forEach(species => {
      this.foundSpeciesIds.delete(species.id);
    });
    this.currentStage = 1; // Reset to first stage of round
    this.saveProgress();
    console.log(`[SpeciesManager] Cleared progress for Round ${this.currentRound}`);
  }

  /**
   * Advance to next stage
   * Returns true if moved to next stage, false if round is complete
   */
  advanceStage() {
    if (this.currentStage < 6) {
      this.currentStage++;
      this.saveProgress(); // Save after advancing stage
      return true;
    }
    return false;
  }

  /**
   * Advance to next round
   * Resets stage to 1
   */
  advanceRound() {
    if (this.currentRound < 5) {
      this.currentRound++;
      this.currentStage = 1;
      this.saveProgress(); // Save after advancing round
      return true;
    }
    return false;
  }

  /**
   * Get round letter (A, B, C, D, E)
   */
  getRoundLetter(round = this.currentRound) {
    return String.fromCharCode('A'.charCodeAt(0) + (round - 1));
  }

  /**
   * Get panel image path based on how many species have been found in current round
   */
  getPanelPath() {
    const letter = this.getRoundLetter();
    const foundCount = this.getFoundSpeciesInRound(this.currentRound).length;
    // Panel number = found count (A0 = 0 found, A1 = 1 found, etc.)
    
    return `/game-assets/recorrido/paneles/${letter}/paneles${letter}${foundCount}.png`;
  }

  /**
   * Reset to beginning
   */
  reset() {
    this.currentRound = 1;
    this.currentStage = 1;
    this.foundSpeciesIds.clear();
    this.saveProgress(); // Save after reset
  }

  /**
   * Set specific round and stage manually (for testing/debugging)
   */
  setRoundAndStage(round, stage) {
    if (round < 1 || round > 5) {
      console.warn(`[SpeciesManager] Invalid round ${round}. Must be 1-5.`);
      return false;
    }
    if (stage < 1 || stage > 6) {
      console.warn(`[SpeciesManager] Invalid stage ${stage}. Must be 1-6.`);
      return false;
    }
    this.currentRound = round;
    this.currentStage = stage;
    this.saveProgress(); // Save after manual change
    console.log(`[SpeciesManager] Set to Round ${round}, Stage ${stage} (${this.getRoundLetter()}${stage})`);
    return true;
  }

  /**
   * Get progress summary
   */
  getProgress() {
    return {
      round: this.currentRound,
      stage: this.currentStage,
      totalFound: this.foundSpeciesIds.size,
      roundProgress: `${this.getFoundSpeciesInRound(this.currentRound).length}/6`,
      overallProgress: `${this.foundSpeciesIds.size}/30`
    };
  }
}
