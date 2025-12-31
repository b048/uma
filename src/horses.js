
// Utility functions for distributions
const Utils = {
    randomNormal: (mean, std) => {
        let u = 0, v = 0;
        while (u === 0) u = Math.random();
        while (v === 0) v = Math.random();
        const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
        return z * std + mean;
    },

    randomTriangular: (low, mode, high) => {
        const u = Math.random();
        const f = (mode - low) / (high - low);
        if (u <= f) {
            return low + Math.sqrt(u * (high - low) * (mode - low));
        } else {
            return high - Math.sqrt((1 - u) * (high - low) * (high - mode));
        }
    },

    randomCauchy: (loc, scale, min, max) => {
        let x;
        do {
            const u = Math.random();
            x = loc + scale * Math.tan(Math.PI * (u - 0.5));
        } while (x < min || x > max);
        return x;
    },

    randomPoisson: (lambda) => {
        // Simple Knuths but return scalar for continuous movement game
        // Actually lets just return a number around lambda
        const L = Math.exp(-lambda);
        let k = 0;
        let p = 1;
        do {
            k++;
            p *= Math.random();
        } while (p > L);
        return k - 1;
    }
};

export class Horse {
    constructor(name, type, formula, description, color, imagePath) {
        this.name = name;
        this.type = type;
        this.formula = formula;
        this.description = description;
        this.color = color;
        this.image = imagePath; // Changed from icon class to image path
        this.position = 0;
        this.finishTime = null;
        this.history = [];
    }

    reset() {
        this.position = 0;
        this.finishTime = null;
        this.history = [];
    }

    move() { return 0; }

    clamp(val, min = 0, max = 15) {
        return Math.max(min, Math.min(max, val));
    }
}

// TARGET MEAN: ~5.5 for all horses to be competitive.

export class UmaOh extends Horse {
    constructor() {
        super(
            "アドマイヤノーマル", "安定型 (Steady)", "N(μ=5.5, σ=0.8)",
            "極めて安定したラップを刻む正統派。", "#3b82f6", "/horse_admire.png"
        );
    }
    move() {
        return this.clamp(Utils.randomNormal(5.5, 0.8));
    }
}

export class Hayabusa extends Horse {
    constructor() {
        super(
            "カレンダイス", "均等型 (Uniform)", "U(1, 10)",
            "展開に左右されるが、ハマれば強い。", "#ef4444", "/horse_curren.png"
        );
    }
    move() { return 1 + Math.random() * 9; }
}

export class LateSpart extends Horse {
    constructor() {
        super(
            "スエアシキング", "追込型 (Power)", "x ~ Power(0.7)",
            "ゴール直前で強烈な伸びを見せる。", "#10b981", "/horse_suayashi.png"
        );
    }
    move() { const base = Math.random(); return this.clamp(Math.pow(base, 0.7) * 9.5); }
}

export class MuraMura extends Horse {
    constructor() {
        super(
            "ツインターボ", "二面性 (Bimodal)", "50% N(3,1) | 50% N(8,1)",
            "大逃げか、沈むか。極端なレース運び。", "#a855f7", "/horse_twin.png"
        );
    }
    move() { return Math.random() > 0.5 ? this.clamp(Utils.randomNormal(3, 1)) : this.clamp(Utils.randomNormal(8, 1)); }
}

export class Kabukimono extends Horse {
    constructor() {
        super(
            "ワイルドパラドックス", "超大穴 (Cauchy)", "Cauchy(x₀=5.5)",
            "常識外れの動き。奇跡を起こすか？", "#facc15", "/horse_wild.png"
        );
    }
    move() {
        return Utils.randomCauchy(5.5, 1.5, 0, 15);
    }
}

export class Ninja extends Horse {
    constructor() {
        super(
            "ブラックボックス", "爆発型 (LogNormal)", "LnN(μ=1.6, σ=0.4)",
            "未知数のポテンシャルを秘めた黒船。", "#94a3b8", "/horse_black.png"
        );
    }
    move() { return this.clamp(Math.exp(Utils.randomNormal(1.6, 0.4))); }
}

export class RoboUma extends Horse {
    constructor() {
        super(
            "シンボリルール", "精密機械 (Triangular)", "Tri(3.5, 5.5, 7.5)",
            "マニュアル通りの完璧なレース展開。", "#ec4899", "/horse_symboli.png"
        );
    }
    move() {
        return Utils.randomTriangular(3.5, 5.5, 7.5);
    }
}

export class Poyon extends Horse {
    constructor() {
        super(
            "ラッキーカウント", "離散型 (Poisson)", "Poisson(λ=5.5)",
            "一歩一歩、着実に勝利へのカウントを刻む。", "#14b8a6", "/horse_lucky.png"
        );
    }
    move() {
        return Utils.randomPoisson(5.5);
    }
}

export const ROSTER_TYPES = [
    UmaOh, Hayabusa, LateSpart, MuraMura,
    Kabukimono, Ninja, RoboUma, Poyon
];
