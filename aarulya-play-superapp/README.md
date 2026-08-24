# Aarulya Play Super App

Aarulya Play is an original, India-first, mobile-first family game and learning platform. It runs as a static browser application on a laptop without requiring a VPS. A local Node.js server is included for module loading, PWA installation and offline caching.

## Current implementation milestone

- Forty-game catalog across arcade, sports, board, puzzle, simulation, creativity and learning
- Ten browser-playable battle foundations with a shared match lifecycle
- Five laptop-ready learning modules: Quiz Junior, Math Adventure, Word Builder, Robot Lab and School Adventure
- Local player profile, XP, rank, virtual coins, daily mission state and learning progress
- Child, teen and adult/parent audience-mode policy
- Offline application shell and service-worker cache
- No deposits, wagering, cash win/loss or withdrawal
- No live advertising provider, paid provider, credential or production deployment

## Run on the owner laptop

Requirements: Node.js 22 or newer.

```bash
cd aarulya-play-superapp
npm run verify
npm start
```

Open `http://127.0.0.1:4173`. The game arena is at `/index.html` and the learning zone is at `/learning.html`.

The local server binds to `127.0.0.1` by default, so it is not exposed to the public network. Use `HOST=0.0.0.0` only for deliberate testing on a trusted local network.

## Playable battle foundations

1. Aarulya Metro Dash
2. Aarulya Cricket Strike
3. Aarulya Hill Rider
4. Aarulya Chaupar Battle
5. Aarulya Carrom Strike
6. Aarulya Block Puzzle
7. Aarulya Goal Master
8. Aarulya Color Dash
9. Aarulya Memory Battle
10. Aarulya Bubble Arena

## Playable learning modules

1. Aarulya Quiz Junior — general knowledge
2. Aarulya Math Adventure — arithmetic and patterns
3. Aarulya Word Builder — Hindi and English language practice
4. Aarulya Robot Lab — directions, sequences and coding logic
5. Aarulya School Adventure — safety, responsibility and classroom decisions

Each learning module contains at least eight local questions, five-question rounds, explanations, local best scores and no external tracking.

## Remaining production work

- The other thirty catalog games remain planned production modules.
- The ten battle foundations still need deeper levels, original studio-grade art/audio and real device testing.
- Browser accessibility and performance testing remain required.
- A signed Android release, Play Store package, backend account sync and public HTTPS deployment do not yet exist.
- Production advertising remains disconnected until owner-controlled provider, consent, privacy and device verification are complete.

## Verification

`npm run verify` checks:

- the forty-game catalog and phase-two starter contract;
- five learning modules, question integrity, answer grading and non-cash/local-only boundaries;
- required local/offline files, manifest and service-worker coverage.

Source checks are not a substitute for owner-laptop browser and device verification.

## Product boundaries

- Virtual coins are not money and cannot be withdrawn.
- Child profiles must not receive cash prompts, open chat, stranger messaging or gambling-like mechanics.
- Learning modules contain no paid provider, tracking SDK, chat or real-money function.
- Ads must not interrupt active gameplay.
- Remaining catalog entries are not represented as completed games.

## Copyright and originality

Do not copy another game's code, characters, maps, sound, music, logo, screenshots or exact interface. Final artwork and audio must be original or have a recorded licence and source.

## Branch

`agent/aarulya-play-20-game-foundation`
