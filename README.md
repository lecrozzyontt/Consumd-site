# Consumd

> Your personal media archive — track movies, shows, books, and games.

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Set up Supabase

1. Go to [supabase.com](https://supabase.com) and open your project.
2. Navigate to **SQL Editor** and run the contents of `supabase-schema.sql`.
3. This creates the `profiles`, `logs`, and `friendships` tables with RLS policies
   and a trigger that auto-creates a profile row when a user signs up.

### 3. (Optional) RAWG API key for games

Games use [RAWG](https://rawg.io/apidocs). Get a free key and replace
`YOUR_RAWG_API_KEY` in `src/services/rawg.js`. Without it, the games rows
will be empty but nothing will break.

### 4. Run locally

```bash
npm run dev
```

---

## File Structure

```
src/
  context/
    AuthContext.jsx       # Global auth state, Supabase session management
  services/
    supabase.js           # Supabase client
    tmdb.js               # Movies & shows (TMDB API, no key needed in URL)
    openLibrary.js        # Books (Open Library, completely free, no key)
    rawg.js               # Games (RAWG, free key required)
  components/
    Navbar.jsx / .css
    MediaCard.jsx / .css
    CategoryRow.jsx / .css
    ActivityCard.jsx / .css
    LogModal.jsx / .css   # Log any media with rating, review, status
    RatingStars.jsx / .css
    SearchBar.jsx / .css
  pages/
    Auth.jsx / .css       # Login + signup
    Home.jsx / .css       # Trending + friends' activity feed
    Discover.jsx / .css   # Browse & search all media types
    Social.jsx / .css     # Friend requests, friends list
    Profile.jsx / .css    # Stats, favorites grid, journal/watchlist tabs
    Settings.jsx / .css   # Update username, sign out
  styles/
    globals.css           # Design tokens, base styles, typography
  App.jsx                 # Router + auth-protected routes
  main.jsx
```

---

## API Keys / Credentials

| Service      | Key location              | Notes                                  |
|--------------|---------------------------|----------------------------------------|
| Supabase     | `src/services/supabase.js`| Already set to your project            |
| TMDB         | `src/services/tmdb.js`    | Already set — free, no auth required   |
| Open Library | `src/services/openLibrary.js` | No key needed                      |
| RAWG         | `src/services/rawg.js`    | Replace `YOUR_RAWG_API_KEY`            |

---

## Features

- **Auth** — Email/password signup & login via Supabase Auth, with auto-profile creation
- **Home** — Trending movies/shows from TMDB + real friends' activity feed from Supabase
- **Discover** — Multi-type search (movies, shows, books, games) with debounced queries
- **Log Modal** — Log any item with 1–5 star rating, text review, and status
- **Social** — Search users, send/accept/decline friend requests, remove friends
- **Profile** — Live stats, top-rated favorites per category, journal/currently/watchlist tabs, delete entries
- **Settings** — Update username, sign out
# Consumd-site
# Consumd-site
