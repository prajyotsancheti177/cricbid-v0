// Sound effects for auction events
// Using Web Audio API to generate sounds without external files

class AuctionSounds {
    private audioContext: AudioContext | null = null;
    private enabled: boolean = true;

    constructor() {
        // Initialize on first user interaction
        if (typeof window !== 'undefined') {
            this.audioContext = null;
        }
    }

    private getContext(): AudioContext {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        return this.audioContext;
    }

    setEnabled(enabled: boolean) {
        this.enabled = enabled;
    }

    isEnabled(): boolean {
        return this.enabled;
    }

    // Play a victory/sold sound - ascending notes with fanfare feel
    playSoldSound() {
        if (!this.enabled) return;

        try {
            const ctx = this.getContext();
            const now = ctx.currentTime;

            // Create multiple oscillators for a rich victory sound
            const playNote = (frequency: number, startTime: number, duration: number, type: OscillatorType = 'sine') => {
                const osc = ctx.createOscillator();
                const gainNode = ctx.createGain();

                osc.connect(gainNode);
                gainNode.connect(ctx.destination);

                osc.type = type;
                osc.frequency.setValueAtTime(frequency, startTime);

                // Envelope
                gainNode.gain.setValueAtTime(0, startTime);
                gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.05);
                gainNode.gain.linearRampToValueAtTime(0.2, startTime + duration * 0.5);
                gainNode.gain.linearRampToValueAtTime(0, startTime + duration);

                osc.start(startTime);
                osc.stop(startTime + duration);
            };

            // Victory fanfare - ascending notes
            playNote(523.25, now, 0.2, 'triangle'); // C5
            playNote(659.25, now + 0.15, 0.2, 'triangle'); // E5
            playNote(783.99, now + 0.3, 0.2, 'triangle'); // G5
            playNote(1046.50, now + 0.45, 0.4, 'triangle'); // C6

            // Add a subtle bass hit
            playNote(130.81, now, 0.3, 'sine'); // C3

            // Add shimmer effect
            playNote(2093.00, now + 0.5, 0.3, 'sine'); // C7

        } catch (error) {
            console.warn('Could not play sold sound:', error);
        }
    }

    // Play a disappointment/unsold sound - descending
    playUnsoldSound() {
        if (!this.enabled) return;

        try {
            const ctx = this.getContext();
            const now = ctx.currentTime;

            const playNote = (frequency: number, startTime: number, duration: number) => {
                const osc = ctx.createOscillator();
                const gainNode = ctx.createGain();

                osc.connect(gainNode);
                gainNode.connect(ctx.destination);

                osc.type = 'triangle';
                osc.frequency.setValueAtTime(frequency, startTime);

                gainNode.gain.setValueAtTime(0, startTime);
                gainNode.gain.linearRampToValueAtTime(0.2, startTime + 0.05);
                gainNode.gain.linearRampToValueAtTime(0, startTime + duration);

                osc.start(startTime);
                osc.stop(startTime + duration);
            };

            // Descending notes for unsold
            playNote(392, now, 0.25); // G4
            playNote(349.23, now + 0.2, 0.25); // F4
            playNote(293.66, now + 0.4, 0.4); // D4

        } catch (error) {
            console.warn('Could not play unsold sound:', error);
        }
    }

    // Play bid sound - quick blip
    playBidSound() {
        if (!this.enabled) return;

        try {
            const ctx = this.getContext();
            const now = ctx.currentTime;

            const osc = ctx.createOscillator();
            const gainNode = ctx.createGain();

            osc.connect(gainNode);
            gainNode.connect(ctx.destination);

            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, now); // A5

            gainNode.gain.setValueAtTime(0, now);
            gainNode.gain.linearRampToValueAtTime(0.15, now + 0.02);
            gainNode.gain.linearRampToValueAtTime(0, now + 0.1);

            osc.start(now);
            osc.stop(now + 0.1);

        } catch (error) {
            console.warn('Could not play bid sound:', error);
        }
    }
}

// Singleton instance
export const auctionSounds = new AuctionSounds();
