import { ROSTER_TYPES } from './horses.js';

const TRACK_LENGTH = 100;

export class RaceEngine {
    constructor() {
        // Pick 3 random distinct horses
        this.horses = this.pickRandomHorses(3);
        this.odds = {};
        this.calculateOdds();
    }

    pickRandomHorses(count) {
        // Shuffle types
        const shuffled = [...ROSTER_TYPES].sort(() => 0.5 - Math.random());
        // Take top 'count'
        const selectedTypes = shuffled.slice(0, count);
        return selectedTypes.map(Type => new Type());
    }

    calculateOdds() {
        const SIMULATIONS = 3000; // Increase sim count for better accuracy with 3 horses
        const wins = new Array(this.horses.length).fill(0);

        for (let i = 0; i < SIMULATIONS; i++) {
            // Clone current matchup
            const simHorses = this.horses.map(h => new h.constructor());
            let winner = -1;
            let steps = 0;

            while (winner === -1 && steps < 1000) {
                simHorses.forEach((h, idx) => {
                    h.position += h.move();
                    if (h.position >= TRACK_LENGTH && winner === -1) {
                        winner = idx;
                    }
                });
                steps++;
            }
            if (winner !== -1) wins[winner]++;
        }

        this.horses.forEach((h, idx) => {
            const winProb = Math.max(wins[idx] / SIMULATIONS, 0.001);
            // Dynamic House Edge: If unbalanced, improve odds slightly
            let rawOdds = 0.92 / winProb;

            if (rawOdds < 1.01) rawOdds = 1.01;
            if (rawOdds > 100) rawOdds = 100;

            this.odds[h.name] = rawOdds.toFixed(2);
        });
    }

    getHorses() {
        return this.horses;
    }

    getOdds(horseName) {
        return this.odds[horseName] || "---";
    }

    tick() {
        let finished = false;
        this.horses.forEach(h => {
            if (h.finishTime) return;

            const moveAmt = h.move();
            h.position += moveAmt;
            h.history.push(h.position);

            if (h.position >= TRACK_LENGTH) {
                h.position = TRACK_LENGTH;
                h.finishTime = Date.now();
                finished = true;
            }
        });
        return finished;
    }

    getWinner() {
        const finished = this.horses.filter(h => h.finishTime !== null);
        if (finished.length === 0) return null;
        finished.sort((a, b) => a.finishTime - b.finishTime);
        return finished[0];
    }
}
