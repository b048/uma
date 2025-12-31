# Zodiac Dash (Web Version)

A probability-driven horse racing game for the Year of the Horse.

## Quick Start
1.  Install dependencies:
    ```bash
    npm install
    ```
2.  Start the game:
    ```bash
    npm run dev
    ```
3.  Open the browser at `http://localhost:5173`.

## Features
- **8 Unique Horses**: Each runs on a different probability distribution (Gaussian, Uniform, Power, etc.).
- **Live Odds**: Calculated via Monte Carlo simulation before every race.
- **Leaderboard**: Global ranking system (requires Supabase) or Local high scores.

## Setup Leaderboard (Optional)
To enable real global rankings:
1.  Create a project at [Supabase](https://supabase.com).
2.  Create a table `leaderboard` with columns:
    - `id` (int8, primary key)
    - `username` (text, unique)
    - `total_winnings` (int8)
    - `updated_at` (timestamptz)
3.  Create a `.env` file in this folder:
    ```env
    VITE_SUPABASE_URL=https://xyz.supabase.co
    VITE_SUPABASE_KEY=your_public_anon_key
    ```
