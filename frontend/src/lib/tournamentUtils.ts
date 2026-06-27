/**
 * Get the currently selected tournament ID from localStorage
 * @returns The tournament ID or a default fallback
 */
export const getSelectedTournamentId = (): string => {
  if (typeof window === 'undefined') return '671b0a000000000000000001';
  
  const tournamentId = localStorage.getItem('selectedTournamentId');
  return tournamentId || '671b0a000000000000000001';
};

/**
 * Set the selected tournament ID in localStorage
 * @param tournamentId - The tournament ID to set
 */
export const setSelectedTournamentId = (tournamentId: string): void => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('selectedTournamentId', tournamentId);
  }
};

/**
 * Clear the selected tournament ID from localStorage
 */
export const clearSelectedTournamentId = (): void => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('selectedTournamentId');
  }
};
