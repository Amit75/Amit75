# Aarulya Play Super App

Aarulya Play is an original, India-first, mobile-first family game platform. One application hosts independent games while sharing profile, progression, missions, ranks and non-cash virtual rewards.

## Current implementation milestone

- Common battle lifecycle: ready -> active -> completed -> result
- Shared player profile, XP, rank, virtual coins and daily mission state
- Forty-game catalog across arcade, sports, board, puzzle, simulation, creativity and learning
- Ten browser-playable foundations wired into the common battle shell
- Child, teen and adult/parent audience-mode policy
- Non-disruptive ad-placement rules with live ad serving disabled until a provider account is connected
- Settled-revenue allocation and funded-campaign gates
- Originality, asset-licensing and child-safety boundaries
- No deposits, wagering, cash win/loss or withdrawal

## Playable foundations

1. Aarulya Metro Dash — three-lane dodge battle
2. Aarulya Cricket Strike — six-ball timing battle
3. Aarulya Hill Rider — speed and balance race
4. Aarulya Chaupar Battle — quick board race
5. Aarulya Carrom Strike — five-shot aim battle
6. Aarulya Block Puzzle — row and column clearing score battle
7. Aarulya Goal Master — five-penalty football battle
8. Aarulya Color Dash — Hindi colour reflex battle
9. Aarulya Memory Battle — sixteen-card pair matching
10. Aarulya Bubble Arena — connected-colour bubble scoring

These are browser game foundations with independent rules and result flows. They are not being represented as final studio-grade releases; animation, audio, art assets, level depth and device testing remain production work.

## Remaining production catalog

11. Aarulya Neon Stack
12. Aarulya Quiz Junior
13. Aarulya Snake Ladder Adventure
14. Aarulya Traffic Escape
15. Aarulya Fruit Blast
16. Aarulya Number Merge
17. Aarulya Basketball Shot
18. Aarulya Treasure Tower
19. Aarulya Pattern Recall
20. Aarulya Mini Bike Sprint
21. Aarulya Craft World
22. Aarulya Obstacle Party
23. Aarulya Pet Town
24. Aarulya Farm Builder
25. Aarulya Cooking Rush
26. Aarulya Fashion Studio
27. Aarulya Drawing Quest
28. Aarulya Math Adventure
29. Aarulya Hide & Seek Party
30. Aarulya Monster Merge
31. Aarulya Water Sort
32. Aarulya Word Builder
33. Aarulya Space Explorer
34. Aarulya Robot Lab
35. Aarulya City Driver
36. Aarulya School Adventure
37. Aarulya Music Beat
38. Aarulya Home Designer
39. Aarulya Rescue Heroes
40. Aarulya Dino Park

## Monetization foundation

Intended revenue sources:

- Contextual ads at natural breaks
- Optional rewarded ads for virtual rewards
- Subscriptions and ad-free access
- Cosmetic themes, characters and environments
- Sponsored non-wagering challenges
- White-label and institutional licensing

Current code keeps the ad provider in `not-connected` state. No live ad SDK, credentials or paid campaign is activated by this milestone.

### Audience rules

- Child: contextual level-end placement only, strict frequency cap, no cash/referral screen and no open chat
- Teen: contextual level-end plus optional rewarded placement; non-cash rewards only
- Adult/Parent: lobby banner, level-end and optional rewarded placement may be eligible after provider approval
- App launch, active gameplay, forced mid-match, pause-button and error-screen ads are blocked

## Revenue-funded reward model

Only verified, settled net revenue may be allocated:

- 55% operations and infrastructure
- 20% game content and development
- 10% referral campaigns
- 10% marketing
- 5% reserve

Cash referral campaigns remain disabled unless the campaign is adult-only, has published terms, verification/fraud controls and enough settled money in the referral bucket.

## Verification source

`npm run verify` runs the source contract check for the forty-game catalog and the five phase-two starters. This does not replace browser, accessibility, performance or device testing.

## Product boundaries

- Virtual coins are not money and cannot be withdrawn.
- Child profiles must not receive cash prompts, open chat, stranger messaging or gambling-like mechanics.
- Ads must not interrupt active gameplay.
- Remaining catalog entries are production modules, not falsely claimed as completed games.

## Copyright and originality rules

- Do not copy another game's code, characters, maps, sound, music, logo, screenshots or exact interface.
- Keep an asset register for every external asset with its licence and source.
- Commission or produce original artwork and audio for final production.
- Similar genres are allowed; copied expression and branded identity are not.
- Sandbox, runner, board, party and simulation modules must use Aarulya-original worlds, characters, level layouts, UI and progression.

## Branch

`agent/aarulya-play-20-game-foundation`
